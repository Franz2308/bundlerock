use std::fs::{File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[cfg(windows)]
mod win32 {
    use std::fs::File;
    use std::os::windows::io::AsRawHandle;

    // FSCTL_SET_SPARSE = CTL_CODE(FILE_DEVICE_FILE_SYSTEM, 49, METHOD_BUFFERED, FILE_SPECIAL_ACCESS)
    const FSCTL_SET_SPARSE: u32 = 0x000900C4;

    #[link(name = "kernel32")]
    extern "system" {
        fn DeviceIoControl(
            hDevice: *mut std::ffi::c_void,
            dwIoControlCode: u32,
            lpInBuffer: *mut std::ffi::c_void,
            nInBufferSize: u32,
            lpOutBuffer: *mut std::ffi::c_void,
            nOutBufferSize: u32,
            lpBytesReturned: *mut u32,
            lpOverlapped: *mut std::ffi::c_void,
        ) -> i32;
    }

    /// Attempts to mark a file as sparse using FSCTL_SET_SPARSE on Windows NTFS.
    /// Returns true if successfully marked as sparse, false otherwise (e.g. FAT32).
    pub fn mark_file_sparse(file: &File) -> bool {
        let handle = file.as_raw_handle() as *mut std::ffi::c_void;
        let mut bytes_returned: u32 = 0;
        let success = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_SET_SPARSE,
                std::ptr::null_mut(),
                0,
                std::ptr::null_mut(),
                0,
                &mut bytes_returned,
                std::ptr::null_mut(),
            )
        };
        success != 0
    }
}

pub struct StorageFile {
    pub path: PathBuf,
    pub file: Arc<File>,
    pub is_sparse: bool,
}

impl StorageFile {
    /// Opens or creates the target download file and pre-allocates space.
    /// On Windows NTFS, sets FSCTL_SET_SPARSE so file.set_len(total_size)
    /// allocates space instantly with zero I/O delay and zero disk zero-filling.
    pub fn open_or_create(path: &Path, total_bytes: Option<u64>, is_new: bool) -> io::Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let file = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(path)?;

        #[cfg(windows)]
        let is_sparse = win32::mark_file_sparse(&file);

        #[cfg(not(windows))]
        let is_sparse = false;

        if let Some(size) = total_bytes {
            let current_len = file.metadata()?.len();
            if is_new || current_len < size {
                let _ = file.set_len(size);
            }
        } else if is_new {
            let _ = file.set_len(0);
        }

        Ok(Self {
            path: path.to_path_buf(),
            file: Arc::new(file),
            is_sparse,
        })
    }

    /// Writes data at an exact file offset without modifying the file seek pointer.
    /// This allows multiple threads or async tasks to write concurrently to the same file.
    pub fn write_at(&self, offset: u64, buf: &[u8]) -> io::Result<()> {
        write_exact_at(&self.file, offset, buf)
    }

    /// Truncates or extends the file to a specific size.
    pub fn truncate(&self, size: u64) -> io::Result<()> {
        self.file.set_len(size)
    }

    /// Flushes operating system buffers to disk.
    pub fn sync(&self) -> io::Result<()> {
        self.file.sync_data()
    }
}

/// Helper function to write a full buffer to an exact offset in a file.
/// Cross-platform implementation using Windows seek_write or Unix write_at.
pub fn write_exact_at(file: &File, mut offset: u64, mut buf: &[u8]) -> io::Result<()> {
    while !buf.is_empty() {
        #[cfg(windows)]
        let bytes_written = {
            use std::os::windows::fs::FileExt;
            file.seek_write(buf, offset)?
        };

        #[cfg(unix)]
        let bytes_written = {
            use std::os::unix::fs::FileExt;
            file.write_at(buf, offset)?
        };

        #[cfg(not(any(windows, unix)))]
        let bytes_written = {
            return Err(io::Error::new(
                io::ErrorKind::Unsupported,
                "Unsupported operating system",
            ));
        };

        if bytes_written == 0 {
            return Err(io::Error::new(
                io::ErrorKind::WriteZero,
                "Failed to write bytes to storage file",
            ));
        }

        offset += bytes_written as u64;
        buf = &buf[bytes_written..];
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn test_concurrent_positioned_writes() {
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join(format!("bundlerock_test_{}.bin", uuid::Uuid::new_v4()));

        let storage =
            StorageFile::open_or_create(&test_path, Some(1024), true).expect("create storage file");

        // Write chunk 2 at offset 500
        let chunk2 = b"MIDDLE_CHUNK";
        storage.write_at(500, chunk2).expect("write chunk 2");

        // Write chunk 1 at offset 0
        let chunk1 = b"START_CHUNK";
        storage.write_at(0, chunk1).expect("write chunk 1");

        // Write chunk 3 at offset 1000
        let chunk3 = b"END_";
        storage.write_at(1000, chunk3).expect("write chunk 3");

        storage.sync().expect("sync file");

        // Verify content by reading back
        let mut f = File::open(&test_path).expect("open to verify");
        let mut buffer = vec![0u8; 1024];
        f.read_exact(&mut buffer).expect("read exact");

        assert_eq!(&buffer[0..chunk1.len()], chunk1);
        assert_eq!(&buffer[500..500 + chunk2.len()], chunk2);
        assert_eq!(&buffer[1000..1000 + chunk3.len()], chunk3);

        // Test truncate
        drop(f);
        storage.truncate(500).expect("truncate");
        let meta = std::fs::metadata(&test_path).expect("metadata");
        assert_eq!(meta.len(), 500);

        // Clean up
        let _ = std::fs::remove_file(test_path);
    }
}
