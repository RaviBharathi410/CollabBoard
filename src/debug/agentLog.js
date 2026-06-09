export function agentLog(source, message, data, code, info) {
    if (process.env.NODE_ENV === 'development') {
        console.log(`[AgentLog] ${source}: ${message}`, data || '', code || '', info || '');
    }
}
