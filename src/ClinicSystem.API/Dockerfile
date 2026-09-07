FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["ClinicSystem.API/ClinicSystem.API.csproj", "ClinicSystem.API/"]
COPY ["ClinicSystem.Application/ClinicSystem.Application.csproj", "ClinicSystem.Application/"]
COPY ["ClinicSystem.Domain/ClinicSystem.Domain.csproj", "ClinicSystem.Domain/"]
COPY ["ClinicSystem.Infrastructure/ClinicSystem.Infrastructure.csproj", "ClinicSystem.Infrastructure/"]
RUN dotnet restore "ClinicSystem.API/ClinicSystem.API.csproj"

COPY . .
RUN dotnet publish "ClinicSystem.API/ClinicSystem.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "ClinicSystem.API.dll"]
