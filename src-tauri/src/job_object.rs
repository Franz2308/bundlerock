//! Windows Job Object management for BundleRock.
//! Guarantees that any spawned child process (yt-dlp, ffmpeg, ffprobe) is forcefully
//! terminated by the Windows kernel if the main BundleRock process exits, closes, or crashes.

#![allow(non_snake_case, non_camel_case_types, non_upper_case_globals)]

#[cfg(windows)]
pub static GLOBAL_JOB_HANDLE: std::sync::atomic::AtomicPtr<std::ffi::c_void> =
    std::sync::atomic::AtomicPtr::new(std::ptr::null_mut());

#[cfg(windows)]
#[allow(non_camel_case_types)]
mod win32 {
    use std::ffi::c_void;

    pub type HANDLE = *mut c_void;
    pub type BOOL = i32;
    pub type DWORD = u32;
    pub type ULONG_PTR = usize;
    pub type SIZE_T = usize;

    pub const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: DWORD = 0x00002000;
    pub const JobObjectExtendedLimitInformation: DWORD = 9;

    #[repr(C)]
    pub struct IO_COUNTERS {
        pub ReadOperationCount: u64,
        pub WriteOperationCount: u64,
        pub OtherOperationCount: u64,
        pub ReadTransferCount: u64,
        pub WriteTransferCount: u64,
        pub OtherTransferCount: u64,
    }

    #[repr(C)]
    pub struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
        pub PerProcessUserTimeLimit: i64,
        pub PerJobUserTimeLimit: i64,
        pub LimitFlags: DWORD,
        pub MinimumWorkingSetSize: SIZE_T,
        pub MaximumWorkingSetSize: SIZE_T,
        pub ActiveProcessLimit: DWORD,
        pub Affinity: ULONG_PTR,
        pub PriorityClass: DWORD,
        pub SchedulingClass: DWORD,
    }

    #[repr(C)]
    pub struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
        pub BasicLimitInformation: JOBOBJECT_BASIC_LIMIT_INFORMATION,
        pub IoInfo: IO_COUNTERS,
        pub ProcessMemoryLimit: SIZE_T,
        pub JobMemoryLimit: SIZE_T,
        pub PeakProcessMemoryLimit: SIZE_T,
        pub PeakJobMemoryLimit: SIZE_T,
    }

    #[link(name = "kernel32")]
    extern "system" {
        pub fn CreateJobObjectW(
            lpJobAttributes: *mut c_void,
            lpName: *const u16,
        ) -> HANDLE;

        pub fn SetInformationJobObject(
            hJob: HANDLE,
            JobObjectInformationClass: DWORD,
            lpJobObjectInformation: *const c_void,
            cbJobObjectInformationLength: DWORD,
        ) -> BOOL;

        pub fn AssignProcessToJobObject(
            hJob: HANDLE,
            hProcess: HANDLE,
        ) -> BOOL;

        pub fn GetCurrentProcess() -> HANDLE;
    }
}

/// Initializes a process-wide Job Object on Windows with JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE.
/// When BundleRock terminates for any reason, the Windows kernel automatically terminates all child processes.
pub fn init_process_job_object() {
    #[cfg(windows)]
    unsafe {
        let job = win32::CreateJobObjectW(std::ptr::null_mut(), std::ptr::null());
        if !job.is_null() {
            let mut info: win32::JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = win32::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let set_res = win32::SetInformationJobObject(
                job,
                win32::JobObjectExtendedLimitInformation,
                &info as *const _ as *const _,
                std::mem::size_of::<win32::JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
            );

            if set_res != 0 {
                let assign_res = win32::AssignProcessToJobObject(job, win32::GetCurrentProcess());
                if assign_res != 0 {
                    GLOBAL_JOB_HANDLE.store(job, std::sync::atomic::Ordering::SeqCst);
                    println!("[job_object] Windows Job Object active with KILL_ON_JOB_CLOSE limit");
                    return;
                }
            }
            // In case assign failed (e.g. running under restricted nested container), keep handle alive
            GLOBAL_JOB_HANDLE.store(job, std::sync::atomic::Ordering::SeqCst);
        }
    }
}
