# ---- Build stage ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /build

COPY pom.xml .
# Download dependencies first (cached layer)
RUN apt-get update && apt-get install -y maven && \
    mvn dependency:go-offline -B

COPY src ./src
RUN mvn package -DskipTests -q

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN mkdir -p /app/uploads && chown appuser:appuser /app/uploads

COPY --from=build /build/target/*.jar app.jar

USER appuser

EXPOSE 9001

ENTRYPOINT ["java", "-jar", "app.jar"]
