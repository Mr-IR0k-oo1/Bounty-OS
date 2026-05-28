use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};

pub fn rate_limit_layer() -> GovernorLayer {
    let quota = Quota::per_minute(NonZeroU32::new(200).unwrap());
    let config = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(quota.replenish_interval().as_secs() as u64)
            .burst_size(200)
            .finish()
            .unwrap(),
    );
    GovernorLayer { config }
}

pub fn login_rate_limit_layer() -> GovernorLayer {
    let quota = Quota::with_period(Duration::from_secs(900))
        .unwrap()
        .allow_burst(NonZeroU32::new(5).unwrap());
    let config = Arc::new(
        GovernorConfigBuilder::default()
            .per_second(quota.replenish_interval().as_secs() as u64)
            .burst_size(5)
            .finish()
            .unwrap(),
    );
    GovernorLayer { config }
}
