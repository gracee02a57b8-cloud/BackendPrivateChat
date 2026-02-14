# WebRTC Chat Backend

This project is a WebRTC-based chat application that supports real-time communication for up to 30 users. It is built using Java and Spring Boot, leveraging WebSocket for real-time messaging.

## Project Structure

- **src/main/java/com/example/webrtcchat/Main.java**: Entry point of the application.
- **src/main/java/com/example/webrtcchat/config/WebSocketConfig.java**: Configuration for WebSocket settings.
- **src/main/java/com/example/webrtcchat/controller/ChatController.java**: Handles WebSocket messages and manages chat sessions.
- **src/main/java/com/example/webrtcchat/dto/MessageDto.java**: Defines the structure of messages exchanged in the chat.
- **src/main/java/com/example/webrtcchat/service/ChatService.java**: Contains business logic for managing chat messages and user sessions.
- **src/main/java/com/example/webrtcchat/types/index.java**: Defines various types or enums used throughout the application.
- **src/main/resources/application.yml**: Configuration file for the Spring Boot application.
- **pom.xml**: Maven configuration file listing dependencies.

## Setup Instructions

1. **Clone the repository**:
   ```
   git clone <repository-url>
   cd webrtc-chat-backend
   ```

2. **Build the project**:
   ```
   mvn clean install
   ```

3. **Run the application**:
   ```
   mvn spring-boot:run
   ```

4. **Access the chat application**:
   Open your web browser and navigate to `http://localhost:8080`.

## Usage

- Users can join the chat and communicate in real-time.
- The application supports up to 30 concurrent users.
- Messages are exchanged using WebSocket for low-latency communication.

## Features

- Real-time messaging
- Group chat support
- User session management

## Security

- Implement user authentication and authorization.
- Consider using encryption for message transmission.

## Future Enhancements

- Support for private messaging.
- Message history storage.
- Mobile client support.

## Questions

For further development, please consider the following questions:
1. What specific features do you want in the chat application (e.g., user authentication, message history)?
2. Do you have a preferred database for storing user data and chat messages?
3. Should the chat support private messaging or only group chats?
4. What security measures do you want to implement (e.g., encryption, user authentication)?
5. Are there any specific libraries or frameworks you want to use besides Spring Boot?
6. What is the expected deployment environment (e.g., cloud service, on-premises)?
7. Do you need support for mobile clients, or is it strictly a web application?