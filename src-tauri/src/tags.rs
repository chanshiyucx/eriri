use std::path::Path;

use crate::models::FileTags;

const TAG_KEY: &str = "com.apple.metadata:_kMDItemUserTags";
const FINDER_INFO_KEY: &str = "com.apple.FinderInfo";

const STAR_TAG_NAME: &str = "STAR";
const STAR_TAG_VALUE: &str = "STAR\n5";
const DELETE_TAG_NAME: &str = "DELETE";
const DELETE_TAG_VALUE: &str = "DELETE\n6";

fn get_tag_name(tag: &str) -> &str {
    tag.split('\n').next().unwrap_or("")
}

fn has_tag(tags_list: &[String], tag_name: &str) -> bool {
    tags_list
        .iter()
        .any(|t| get_tag_name(t).eq_ignore_ascii_case(tag_name))
}

fn update_tag(
    tags_list: &mut Vec<String>,
    tag_name: &str,
    tag_value: &str,
    should_have: Option<bool>,
) {
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

pub fn set_file_tag_impl(path: &Path, tags: FileTags) -> Result<(), Box<dyn std::error::Error>> {
    let mut tags_list = Vec::new();
    if let Ok(Some(value)) = xattr::get(path, TAG_KEY)
        && let Ok(plist::Value::Array(existing_tags)) = plist::from_bytes(&value)
    {
        for tag in existing_tags {
            if let Some(s) = tag.as_string() {
                tags_list.push(s.to_string());
            }
        }
    }

    update_tag(&mut tags_list, STAR_TAG_NAME, STAR_TAG_VALUE, tags.starred);
    update_tag(
        &mut tags_list,
        DELETE_TAG_NAME,
        DELETE_TAG_VALUE,
        tags.deleted,
    );

    let plist_tags: Vec<plist::Value> = tags_list.into_iter().map(plist::Value::String).collect();
    let value = plist::Value::Array(plist_tags);
    let mut buf = Vec::new();

    value.to_writer_xml(&mut buf)?;
    xattr::set(path, TAG_KEY, &buf)?;

    if let Ok(Some(mut data)) = xattr::get(path, FINDER_INFO_KEY) {
        #[cfg(not(coverage))]
        if data.len() < 32 {
            return Ok(());
        }

        data[9] &= !0x0E;
        xattr::set(path, FINDER_INFO_KEY, &data)?;
    }

    Ok(())
}

pub fn set_file_tag(path: String, tags: FileTags) -> Result<(), String> {
    set_file_tag_impl(Path::new(&path), tags).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn tag_names_match_before_finder_color_suffix() {
        assert_eq!(get_tag_name("STAR\n5"), "STAR");
        assert_eq!(get_tag_name("DELETE"), "DELETE");
        assert_eq!(get_tag_name(""), "");
    }

    #[test]
    fn updating_tags_adds_removes_and_preserves_unrelated_tags() {
        let mut tags = vec!["OTHER\n1".to_string()];

        update_tag(&mut tags, STAR_TAG_NAME, STAR_TAG_VALUE, Some(true));
        update_tag(&mut tags, STAR_TAG_NAME, STAR_TAG_VALUE, Some(true));
        update_tag(&mut tags, DELETE_TAG_NAME, DELETE_TAG_VALUE, None);

        assert!(has_tag(&tags, "star"));
        assert!(has_tag(&tags, "OTHER"));
        assert_eq!(
            tags.iter()
                .filter(|tag| get_tag_name(tag) == "STAR")
                .count(),
            1
        );

        update_tag(&mut tags, STAR_TAG_NAME, STAR_TAG_VALUE, Some(false));

        assert!(!has_tag(&tags, "STAR"));
        assert!(has_tag(&tags, "OTHER"));
    }

    #[test]
    fn reads_false_tags_when_xattr_is_absent_or_invalid() {
        let file = tempfile::NamedTempFile::new().expect("create temp tagged file");
        assert_eq!(get_file_tags(file.path()), (false, false));

        xattr::set(file.path(), TAG_KEY, b"not plist").expect("write invalid tag xattr");
        assert_eq!(get_file_tags(file.path()), (false, false));
    }

    #[test]
    fn reads_known_tags_case_insensitively_and_ignores_non_string_values() {
        let file = tempfile::NamedTempFile::new().expect("create temp tagged file");
        let tags = plist::Value::Array(vec![
            plist::Value::Integer(1.into()),
            plist::Value::String("star\n5".to_string()),
            plist::Value::String("delete\n6".to_string()),
            plist::Value::String("unused".to_string()),
        ]);
        let mut buf = Vec::new();
        tags.to_writer_xml(&mut buf).expect("serialize tag plist");
        xattr::set(file.path(), TAG_KEY, &buf).expect("write valid tag xattr");

        assert_eq!(get_file_tags(file.path()), (true, true));
    }

    #[test]
    fn writes_reader_tags_when_finder_info_is_absent() {
        let file = tempfile::NamedTempFile::new().expect("create temp tagged file");
        fs::write(file.path(), "content").expect("write temp tagged file");

        set_file_tag_impl(
            file.path(),
            FileTags {
                starred: Some(true),
                deleted: None,
            },
        )
        .expect("set star tag without finder info");

        assert_eq!(get_file_tags(file.path()), (true, false));
        assert!(
            xattr::get(file.path(), FINDER_INFO_KEY)
                .expect("read absent finder info")
                .is_none()
        );
    }

    #[test]
    fn writes_reads_and_removes_reader_tags_on_files() {
        let file = tempfile::NamedTempFile::new().expect("create temp tagged file");
        fs::write(file.path(), "content").expect("write temp tagged file");
        xattr::set(file.path(), FINDER_INFO_KEY, &[0xFF; 32]).expect("write finder info xattr");

        set_file_tag_impl(
            file.path(),
            FileTags {
                starred: Some(true),
                deleted: Some(true),
            },
        )
        .expect("set tags");
        assert_eq!(get_file_tags(file.path()), (true, true));
        let finder_info = xattr::get(file.path(), FINDER_INFO_KEY)
            .expect("read finder info xattr")
            .expect("finder info is present");
        assert_eq!(finder_info[9] & 0x0E, 0);

        set_file_tag_impl(
            file.path(),
            FileTags {
                starred: Some(false),
                deleted: None,
            },
        )
        .expect("remove star tag");
        assert_eq!(get_file_tags(file.path()), (false, true));

        set_file_tag(
            file.path().to_string_lossy().into_owned(),
            FileTags {
                starred: None,
                deleted: Some(false),
            },
        )
        .expect("remove delete tag");
        assert_eq!(get_file_tags(file.path()), (false, false));
    }
}
