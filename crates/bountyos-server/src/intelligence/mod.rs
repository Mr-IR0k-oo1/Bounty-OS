//! Investigation Intelligence Engine
//!
//! Provides deterministic reasoning, attack surface state modeling, coverage tracking,
//! uncertainty measurement, candidate action generation, and scoring for Bug Bounty investigations.

pub mod action_value;
pub mod actions;
pub mod archetype;
pub mod budgets;
pub mod coverage;
pub mod experience;
pub mod graph;
pub mod llm;
pub mod observations;
pub mod planner;
pub mod policies;
pub mod profiler;
pub mod runner;
pub mod scoring;
pub mod state;
pub mod stopping;
pub mod telemetry;
pub mod uncertainty;

pub use action_value::{ActionValueModel, HistoricalToolStats, ValueWeights};
pub use actions::{ActionType, PlannedAction};
pub use graph::AttackSurfaceGraph;
pub use observations::{IngestionMetrics, Observation, ObservationIngestion};
pub use planner::{IntelligencePlanner, InvestigationPlan};
pub use policies::{InvestigationPolicy, PolicyDecision, PolicyRegistry};
pub use profiler::TargetProfiler;
pub use runner::{
    list_investigation_actions, save_investigation_action, AutonomousInvestigationRunner,
    InvestigationRunSummary, RunInvestigationRequest, StateSummary,
};
pub use state::InvestigationState;
pub use telemetry::{
    get_historical_tool_stats, list_action_outcomes, list_all_action_outcomes,
    save_action_outcome, StateSnapshot, TelemetryCollector,
};
