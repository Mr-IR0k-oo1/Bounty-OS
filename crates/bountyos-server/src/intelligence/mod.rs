//! Investigation Intelligence Engine
//!
//! Provides deterministic reasoning, attack surface state modeling, coverage tracking,
//! uncertainty measurement, candidate action generation, and scoring for Bug Bounty investigations.

pub mod action_value;
pub mod actions;
pub mod adaptive_planner;
pub mod archetype;
pub mod authz;
pub mod behavior;
pub mod budgets;
pub mod coverage;
pub mod education;
pub mod experience;
pub mod flows;
pub mod graph;
pub mod llm;
pub mod observations;
pub mod planner;
pub mod policies;
pub mod profiler;
pub mod roi;
pub mod runner;
pub mod scoring;
pub mod state;
pub mod stopping;
pub mod telemetry;
pub mod threat_model;
pub mod uncertainty;

pub use action_value::{ActionValueModel, HistoricalToolStats, ValueWeights};
pub use actions::{ActionType, PlannedAction};
pub use adaptive_planner::{
    AdaptivePlan, AdaptivePlanner, AdaptiveScorer, PlannerActionDef, PlannerCapability,
    PlannerScoreComponents, PreconditionEngine, RedundancyEngine, RejectedCandidate,
};
pub use authz::{AuthzEngine, Identity, AuthorizationBoundary};
pub use behavior::{BehaviorAnalyzer, BehaviorReport, WafVendor};
pub use education::{EducationEngine, EducationLesson};
pub use flows::{FlowEngine, HttpMutation, RequestFlow, FlowReplayResult};
pub use graph::AttackSurfaceGraph;
pub use observations::{IngestionMetrics, Observation, ObservationIngestion};
pub use planner::{IntelligencePlanner, InvestigationPlan};
pub use policies::{InvestigationPolicy, PolicyDecision, PolicyRegistry};
pub use profiler::TargetProfiler;
pub use roi::{RoiEngine, TargetPrioritizationScore};
pub use runner::{
    list_investigation_actions, save_investigation_action, AutonomousInvestigationRunner,
    InvestigationRunSummary, RunInvestigationRequest, StateSummary,
};
pub use state::InvestigationState;
pub use telemetry::{
    get_historical_tool_stats, list_action_outcomes, list_all_action_outcomes,
    save_action_outcome, StateSnapshot, TelemetryCollector,
};
pub use threat_model::{ThreatModelEngine, ThreatItem, StrideCategory, ThreatStatus};

