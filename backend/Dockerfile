# ---- Build stage ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /build

# Copy pom first → dependency cache layer
COPY pom.xml .
RUN apt-get update && apt-get install -y --no-install-recommends maven && \
    mvn dependency:go-offline -B && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY src ./src
RUN mvn package -DskipTests -q

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# wget is included in Alpine for healthchecks; curl for actuator
RUN addgroup -S appuser && adduser -S appuser -G appuser && \
    mkdir -p /app/uploads && chown appuser:appuser /app/uploads

COPY --from=build /build/target/*.jar app.jar

USER appuser

EXPOSE 9001

# Fixed healthcheck (I11): use actuator/health instead of auth endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:9001/actuator/health || exit 1

# JVM opts configurable via env (R9)
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS:--Xmx512m -Xms256m} -jar app.jar"]
