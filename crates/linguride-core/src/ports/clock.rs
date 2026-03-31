pub trait ClockPort {
    fn now_millis(&self) -> u64;
}
