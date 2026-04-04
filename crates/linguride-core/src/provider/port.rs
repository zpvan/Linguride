use linguride_domain::LingurideError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderRequest {
    pub url: String,
    pub method: String,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpResponse {
    pub status: u16,
    pub body: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderStreamSummary {
    pub status: u16,
    pub body: String,
}

pub trait ProviderTransportPort {
    fn send_json(&self, request: ProviderRequest) -> Result<ProviderHttpResponse, LingurideError>;

    fn send_sse(
        &self,
        request: ProviderRequest,
        on_event: &mut dyn FnMut(&str),
    ) -> Result<ProviderStreamSummary, LingurideError>;
}
