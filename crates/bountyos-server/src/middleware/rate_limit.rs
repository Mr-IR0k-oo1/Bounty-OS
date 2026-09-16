use governor::middleware::NoOpMiddleware;
use tower_governor::governor::GovernorConfigBuilder;
use tower_governor::key_extractor::PeerIpKeyExtractor;
use tower_governor::GovernorLayer;

pub fn rate_limit_layer() -> GovernorLayer<'static, PeerIpKeyExtractor, NoOpMiddleware> {
    let config = Box::leak(Box::new(
        GovernorConfigBuilder::default()
            .per_second(60)
            .burst_size(200)
            .finish()
            .unwrap(),
    ));
    GovernorLayer { config }
}

pub fn login_rate_limit_layer() -> GovernorLayer<'static, PeerIpKeyExtractor, NoOpMiddleware> {
    let config = Box::leak(Box::new(
        GovernorConfigBuilder::default()
            .per_second(180)
            .burst_size(5)
            .finish()
            .unwrap(),
    ));
    GovernorLayer { config }
}
