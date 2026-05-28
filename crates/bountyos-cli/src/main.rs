mod config;
mod client;
mod output;
mod commands;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "bountyos", about = "BountyOS CLI")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    Login,
    Logout,
    Project {
        #[command(subcommand)]
        action: ProjectAction,
    },
    Program {
        #[command(subcommand)]
        action: ProgramAction,
    },
    Scope {
        #[command(subcommand)]
        action: ScopeAction,
    },
    Scan {
        #[arg(long)]
        program: Option<String>,
        #[arg(long)]
        stage: Option<i32>,
        #[arg(long)]
        full: bool,
        #[arg(long)]
        skip_active: bool,
    },
    Jobs {
        #[command(subcommand)]
        action: JobAction,
    },
    Findings {
        #[command(subcommand)]
        action: FindingAction,
    },
    Monitor {
        #[command(subcommand)]
        action: MonitorAction,
    },
}

#[derive(Subcommand)]
enum ProjectAction {
    List,
    Add { #[arg(long)] name: Option<String>, #[arg(long)] start: Option<String> },
    Notes { #[arg(long)] id: Option<String> },
    Delete { #[arg(long)] id: Option<String> },
}

#[derive(Subcommand)]
enum ProgramAction {
    List { #[arg(long)] project: Option<String> },
    Add { #[arg(long)] project: Option<String>, #[arg(long)] name: Option<String>, #[arg(long)] platform: Option<String>, #[arg(long)] url: Option<String> },
    Delete { #[arg(long)] slug: Option<String> },
}

#[derive(Subcommand)]
enum ScopeAction {
    List { #[arg(long)] program: Option<String> },
    Add { #[arg(long)] program: Option<String>, #[arg(long)] target: Option<String>, #[arg(long)] r#type: Option<String>, #[arg(long)] out_of_scope: bool },
    Import { #[arg(long)] program: Option<String>, #[arg(long)] file: Option<String> },
    Approve { #[arg(long)] program: Option<String> },
}

#[derive(Subcommand)]
enum JobAction {
    List,
    Logs { id: Option<String> },
    Cancel { id: Option<String> },
}

#[derive(Subcommand)]
enum FindingAction {
    List { #[arg(long)] program: Option<String>, #[arg(long)] severity: Option<String>, #[arg(long)] status: Option<String>, #[arg(long)] unassigned: bool },
    Claim { #[arg(long)] id: Option<String> },
    Validate { #[arg(long)] id: Option<String> },
    Fp { #[arg(long)] id: Option<String> },
    Report { #[arg(long)] id: Option<String>, #[arg(long)] platform: Option<String> },
}

#[derive(Subcommand)]
enum MonitorAction {
    Status,
    Start,
    Stop,
    SetInterval { #[arg(long)] program: Option<String>, #[arg(long)] hours: Option<i32> },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Login => commands::auth::login().await?,
        Commands::Logout => commands::auth::logout().await?,
        Commands::Project { action } => match action {
            ProjectAction::List => commands::projects::list().await?,
            ProjectAction::Add { name, start } => commands::projects::add(name, start).await?,
            ProjectAction::Notes { id } => commands::projects::notes(id).await?,
            ProjectAction::Delete { id } => commands::projects::delete(id).await?,
        },
        Commands::Program { action } => match action {
            ProgramAction::List { project } => commands::programs::list(project).await?,
            ProgramAction::Add { project, name, platform, url } => commands::programs::add(project, name, platform, url).await?,
            ProgramAction::Delete { slug } => commands::programs::delete(slug).await?,
        },
        Commands::Scope { action } => match action {
            ScopeAction::List { program } => commands::scope::list(program).await?,
            ScopeAction::Add { program, target, r#type, out_of_scope } => commands::scope::add(program, target, r#type, out_of_scope).await?,
            ScopeAction::Import { program, file } => commands::scope::import(program, file).await?,
            ScopeAction::Approve { program } => commands::scope::approve(program).await?,
        },
        Commands::Scan { program, stage, full, skip_active } => {
            commands::scan::run_scan(program, stage, full, skip_active).await?
        }
        Commands::Jobs { action } => match action {
            JobAction::List => commands::jobs::list().await?,
            JobAction::Logs { id } => commands::jobs::logs(id).await?,
            JobAction::Cancel { id } => commands::jobs::cancel(id).await?,
        },
        Commands::Findings { action } => match action {
            FindingAction::List { program, severity, status, unassigned } => commands::findings::list(program, severity, status, unassigned).await?,
            FindingAction::Claim { id } => commands::findings::claim(id).await?,
            FindingAction::Validate { id } => commands::findings::validate(id).await?,
            FindingAction::Fp { id } => commands::findings::fp(id).await?,
            FindingAction::Report { id, platform } => commands::findings::report(id, platform).await?,
        },
        Commands::Monitor { action } => match action {
            MonitorAction::Status => commands::monitor::status().await?,
            MonitorAction::Start => commands::monitor::start().await?,
            MonitorAction::Stop => commands::monitor::stop().await?,
            MonitorAction::SetInterval { program, hours } => commands::monitor::set_interval(program, hours).await?,
        },
    }

    Ok(())
}
