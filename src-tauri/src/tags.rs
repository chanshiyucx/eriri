use std::path::Path;

use crate::models::FileTags;

// macOS extended attribute keys
const TAG_KEY: &str = "com.apple.metadata:_kMDItemUserTags";
const FINDER_INFO_KEY: &str = "com.apple.FinderInfo";

// Tag names and values
const STAR_TAG_NAME: &str = "STAR";
const STAR_TAG_VALUE: &str = "STAR\n5";
const DELETE_TAG_NAME: &str = "DELETE";
const DELETE_TAG_VALUE: &str = "DELETE\n6";

/// Extract tag name (before newline) from tag string
fn get_tag_name(tag: &str) -> &str {
    tag.split('\n').next().unwrap_or("")
}

/// Check if tags list contains a specific tag name
fn has_tag(tags_list: &[String], tag_name: &str) -> bool {
    tags_list
        .iter()
        .any(|t| get_tag_name(t).eq_ignore_ascii_case(tag_name))
}

/// Update a specific tag in the tags list
fn update_tag(tags_list: &mut Vec<String>, tag_name: &str, tag_value: &str, should_have: Option<bool>) {
    let Some(should_have) = should_have else {
        return;
    };

    let currently_has = has_tag(tags_list, tag_name);

    match (should_have, currently_has) {
        (true, false) => tags_list.push(tag_value.to_string()),
        (false, true) => tags_list.retain(|t| !get_tag_name(t).eq_ignore_ascii_case(tag_name)),
        _ => {}
    }
}

/// Read file tags from macOS extended attributes
/// Returns (starred, deleted)
pub fn get_file_tags(path: &Path) -> (bool, bool) {
    let Ok(Some(value)) = xattr::get(path, TAG_KEY) else {
        return (false, false);
    };

    let Ok(plist::Value::Array(tags)) = plist::from_bytes(&value) else {
        return (false, false);
    };

    let mut starred = false;
    let mut deleted = false;

    for tag in tags {
        if let Some(tag_str) = tag.as_string() {
            let name = get_tag_name(tag_str);
            if name.eq_ignore_ascii_case(STAR_TAG_NAME) {
                starred = true;
            }
            if name.eq_ignore_ascii_case(DELETE_TAG_NAME) {
                deleted = true;
            }
            if starred && deleted {
                break;
            }
        }
    }

    (starred, deleted)
}

/// Set file tags using macOS extended attributes
pub fn set_file_tag_impl(path: &Path, tags: FileTags) -> Result<(), Box<dyn std::error::Error>> {
    let mut tags_list = Vec::new();
    if let Ok(Some(value)) = xattr::get(path, TAG_KEY) {
        if let Ok(plist::Value::Array(existing_tags)) = plist::from_bytes(&value) {
            for tag in existing_tags {
                if let Some(s) = tag.as_string() {
                    tags_list.push(s.to_string());
                }
            }
        }
    }

    update_tag(&mut tags_list, STAR_TAG_NAME, STAR_TAG_VALUE, tags.starred);
    update_tag(&mut tags_list, DELETE_TAG_NAME, DELETE_TAG_VALUE, tags.deleted);

    let plist_tags: Vec<plist::Value> = tags_list.into_iter().map(plist::Value::String).collect();
    let value = plist::Value::Array(plist_tags);
    let mut buf = Vec::new();

    value.to_writer_xml(&mut buf)?;
    xattr::set(path, TAG_KEY, &buf)?;

    if let Ok(Some(mut data)) = xattr::get(path, FINDER_INFO_KEY) {
        if data.len() >= 32 {
            data[9] &= !0x0E;
            xattr::set(path, FINDER_INFO_KEY, &data)?;
        }
    }

    Ok(())
}

/// Tauri command to set file tags
#[tauri::command]
pub fn set_file_tag(path: String, tags: FileTags) -> Result<(), String> {
    set_file_tag_impl(Path::new(&path), tags).map_err(|e| e.to_string())
}
