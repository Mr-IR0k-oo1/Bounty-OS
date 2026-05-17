//! Redis connection and pool management

use redis::{Client, RedisResult};
use std::sync::Arc;

/// Redis connection pool type
pub type RedisPool = Arc<Client>;

/// Initialize the Redis connection pool
pub async fn init_redis_pool(redis_url: &str) -> RedisResult<RedisPool> {
    let client = Client::open(redis_url)?;
    Ok(Arc::new(client))
}
