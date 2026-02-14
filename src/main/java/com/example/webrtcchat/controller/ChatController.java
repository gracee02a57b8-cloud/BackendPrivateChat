public class ChatController {
    
    // This method will handle incoming WebSocket messages
    @MessageMapping("/chat")
    @SendTo("/topic/messages")
    public MessageDto sendMessage(MessageDto message) {
        // Logic to handle the incoming message
        return message;
    }

    // This method will handle user connection events
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectEvent event) {
        // Logic to manage user connections
    }

    // This method will handle user disconnection events
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        // Logic to manage user disconnections
    }
}