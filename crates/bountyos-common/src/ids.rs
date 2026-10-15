use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;
use uuid::Uuid;

macro_rules! define_id {
    ($name:ident) => {
        #[derive(
            Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize,
        )]
        #[serde(transparent)]
        pub struct $name(pub Uuid);

        impl $name {
            pub fn new() -> Self {
                Self(Uuid::new_v4())
            }

            pub fn from_uuid(uuid: Uuid) -> Self {
                Self(uuid)
            }

            pub fn as_uuid(&self) -> &Uuid {
                &self.0
            }

            pub fn into_uuid(self) -> Uuid {
                self.0
            }
        }

        impl Default for $name {
            fn default() -> Self {
                Self::new()
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                write!(f, "{}", self.0)
            }
        }

        impl From<Uuid> for $name {
            fn from(uuid: Uuid) -> Self {
                Self(uuid)
            }
        }

        impl From<$name> for Uuid {
            fn from(id: $name) -> Self {
                id.0
            }
        }

        impl FromStr for $name {
            type Err = uuid::Error;
            fn from_str(s: &str) -> Result<Self, Self::Err> {
                Uuid::parse_str(s).map(Self)
            }
        }
    };
}

define_id!(ProgramId);
define_id!(ScopeId);
define_id!(TargetId);
define_id!(JobId);
define_id!(AssetId);
define_id!(FindingId);
define_id!(EvidenceId);
define_id!(ReportId);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_id_creation_and_string_roundtrip() {
        let id = ProgramId::new();
        let s = id.to_string();
        let parsed: ProgramId = s.parse().unwrap();
        assert_eq!(id, parsed);
    }

    #[test]
    fn test_id_serde() {
        let id = JobId::new();
        let json = serde_json::to_string(&id).unwrap();
        let deserialized: JobId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, deserialized);
    }
}
