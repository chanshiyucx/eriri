Running DevCommand (`cargo  run --no-default-features --color always --`)
Info Watching /Users/xin/Developer/eriri/src-tauri for changes...
warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:25:27
|
25 | let url: id = msg_send![class!(NSURL), fileURLWithPath: path_nsstring];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: `#[warn(unexpected_cfgs)]` on by default
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:25:37
|
25 | let url: id = msg_send![class!(NSURL), fileURLWithPath: path_nsstring];
| ^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `class` crate for guidance on how handle this unexpected cfg
= help: the macro `class` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `class` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:32:37
|
32 | let bookmark_data: id = msg_send![url,
   |  _____________________________________^
33 | |                 bookmarkDataWithOptions: NS_URL_BOOKMARK_CREATION_WITH_SECURITY_SCOPE
34 | |                 includingResourceValuesForKeys: nil
35 | |                 relativeToURL: nil
36 | |                 error: &mut error
37 | |             ];
| |**\*\***\_**\*\***^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:41:36
|
41 | let desc: id = msg_send![error, localizedDescription];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:49:33
|
49 | let length: usize = msg_send![bookmark_data, length];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:50:36
|
50 | let bytes: \*const u8 = msg_send![bookmark_data, bytes];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:62:37
|
62 | let bookmark_data: id = msg_send![class!(NSData),
   |  _____________________________________^
63 | |                 dataWithBytes: bookmark_bytes.as_ptr()
64 | |                 length: bookmark_bytes.len()
65 | |             ];
| |**\*\***\_**\*\***^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:62:47
|
62 | let bookmark_data: id = msg_send![class!(NSData),
| ^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `class` crate for guidance on how handle this unexpected cfg
= help: the macro `class` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `class` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:73:27
|
73 | let url: id = msg_send![class!(NSURL),
   |  ___________________________^
74 | |                 URLByResolvingBookmarkData: bookmark_data
75 | |                 options: NS_URL_BOOKMARK_RESOLUTION_WITH_SECURITY_SCOPE
76 | |                 relativeToURL: nil
77 | |                 bookmarkDataIsStale: &mut is_stale
78 | |                 error: &mut error
79 | |             ];
| |**\*\***\_**\*\***^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:73:37
|
73 | let url: id = msg_send![class!(NSURL),
| ^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `class` crate for guidance on how handle this unexpected cfg
= help: the macro `class` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `class` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:83:36
|
83 | let desc: id = msg_send![error, localizedDescription];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:92:33
|
92 | let started: BOOL = msg_send![url, startAccessingSecurityScopedResource];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:97:28
|
97 | let path: id = msg_send![url, path];
| ^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: unexpected `cfg` condition value: `cargo-clippy`
--> src/bookmark.rs:106:32
|
106 | let c_str: \*const i8 = msg_send![nsstring, UTF8String];
| ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
|
= note: no expected values for `feature`
= note: using a cfg inside a macro will use the cfgs from the destination crate and not the ones from the defining crate
= help: try referring to `sel_impl` crate for guidance on how handle this unexpected cfg
= help: the macro `sel_impl` may come from an old version of the `objc` crate, try updating your dependency with `cargo update -p objc`
= note: see <https://doc.rust-lang.org/nightly/rustc/check-cfg/cargo-specifics.html> for more information about checking conditional configuration
= note: this warning originates in the macro `sel_impl` which comes from the expansion of the macro `msg_send` (in Nightly builds, run with -Z macro-backtrace for more info)

warning: `eriri` (lib) generated 14 warnings
