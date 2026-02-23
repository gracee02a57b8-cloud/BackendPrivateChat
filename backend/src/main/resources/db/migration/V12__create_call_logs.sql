CREATE TABLE call_logs (
    id VARCHAR(36) PRIMARY KEY,
    caller VARCHAR(50) NOT NULL,
    callee VARCHAR(50) NOT NULL,
    call_type VARCHAR(10),
    status VARCHAR(20) NOT NULL,
    duration INTEGER DEFAULT 0,
    timestamp VARCHAR(30) NOT NULL
);

CREATE INDEX idx_call_logs_caller ON call_logs(caller);
CREATE INDEX idx_call_logs_callee ON call_logs(callee);
CREATE INDEX idx_call_logs_timestamp ON call_logs(timestamp DESC);
