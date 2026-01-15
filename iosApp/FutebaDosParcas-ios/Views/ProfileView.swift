//
//  ProfileView.swift
//  Futeba dos Parças - iOS
//
//  Tela de perfil do usuário
//

import SwiftUI

struct ProfileView: View {
    @StateObject private var viewModel = ProfileViewModel()
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var themeManager: ThemeManager
    @State private var showingSettings = false
    @State private var showingEditProfile = false
    @State private var showingLevelJourney = false

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 0) {
                    // Header do perfil
                    ProfileHeader(user: viewModel.user)
                        .padding()

                    // Level e XP
                    LevelProgressBar(
                        level: viewModel.user?.level ?? 1,
                        xp: viewModel.user?.xp ?? 0,
                        xpToNext: viewModel.xpToNextLevel
                    )
                    .padding(.horizontal)

                    // Estatísticas rápidas
                    StatsGrid(stats: viewModel.quickStats)
                        .padding()

                    // Menu de opções
                    ProfileMenu()
                        .padding(.horizontal)
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Perfil")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }
            }
            .refreshable {
                await viewModel.loadUserData()
            }
            .sheet(isPresented: $showingSettings) {
                SettingsView()
            }
            .sheet(isPresented: $showingEditProfile) {
                EditProfileView(user: viewModel.user)
            }
            .sheet(isPresented: $showingLevelJourney) {
                LevelJourneyView(user: viewModel.user)
            }
        }
        .task {
            await viewModel.loadUserData()
        }
    }
}

// MARK: - Profile Header

struct ProfileHeader: View {
    let user: UserProfile?

    var body: some View {
        HStack(spacing: 16) {
            // Avatar
            AsyncImage(url: URL(string: user?.photoUrl ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                Circle()
                    .fill(Color.appSecondary.opacity(0.3))
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.title)
                            .foregroundColor(.appSecondary)
                    }
            }
            .frame(width: 80, height: 80)
            .clipShape(Circle())
            .overlay(
                Circle().stroke(Color.appPrimary, lineWidth: 3)
            )

            // Info
            VStack(alignment: .leading, spacing: 4) {
                Text(user?.name ?? "Carregando...")
                    .font(.title2)
                    .fontWeight(.bold)

                Text(user?.email ?? "")
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                // Role badge
                if let role = user?.role {
                    RoleBadge(role: role)
                }
            }

            Spacer()
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Role Badge

struct RoleBadge: View {
    let role: String

    var body: some View {
        Text(roleDisplayText)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(roleColor.opacity(0.2))
            .foregroundColor(roleColor)
            .clipShape(Capsule())
    }

    private var roleDisplayText: String {
        switch role {
        case "ADMIN": return "Administrador"
        case "FIELD_OWNER": return "Dono de Quadra"
        case "PLAYER": return "Jogador"
        default: return role
        }
    }

    private var roleColor: Color {
        switch role {
        case "ADMIN": return .purple
        case "FIELD_OWNER": return .orange
        default: return .blue
        }
    }
}

// MARK: - Level Progress Bar

struct LevelProgressBar: View {
    let level: Int
    let xp: Long
    let xpToNext: Long

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Nível \(level)")
                    .font(.headline)
                    .foregroundColor(.appPrimary)

                Spacer()

                Text("\(xp) / \(xpToNext) XP")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.appSecondary.opacity(0.2))

                    RoundedRectangle(cornerRadius: 8)
                        .fill(
                            LinearGradient(
                                colors: [Color.appPrimary, Color.appPrimary.opacity(0.7)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: geometry.size.width * CGFloat(progress))
                }
            }
            .frame(height: 12)
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private var progress: Double {
        guard xpToNext > 0 else { return 0 }
        return min(Double(xp) / Double(xpToNext), 1.0)
    }
}

// MARK: - Stats Grid

struct StatsGrid: View {
    let stats: [QuickStat]

    var body: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible())
        ], spacing: 12) {
            ForEach(stats) { stat in
                StatItem(stat: stat)
            }
        }
    }

    init(stats: [QuickStat]) {
        self.stats = stats
    }
}

struct StatItem: View {
    let stat: QuickStat

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: stat.icon)
                .font(.title3)
                .foregroundColor(stat.color)

            Text("\(stat.value)")
                .font(.headline)

            Text(stat.label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(uiColor: .tertiarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct QuickStat: Identifiable {
    let id = UUID()
    let icon: String
    let label: String
    let value: Int
    let color: Color
}

// MARK: - Profile Menu

struct ProfileMenu: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        VStack(spacing: 1) {
            MenuItem(icon: "person.circle", title: "Editar Perfil", color: .blue) {
                // Navigate to edit profile
            }

            MenuItem(icon: "trophy", title: "Minhas Conquistas", color: .gold) {
                // Navigate to badges
            }

            MenuItem(icon: "chart.bar", title: "Estatísticas", color: .green) {
                // Navigate to statistics
            }

            MenuItem(icon: "calendar", title: "Histórico de Jogos", color: .orange) {
                // Navigate to game history
            }

            Divider()
                .padding(.leading, 60)

            MenuItem(icon: "questionmark.circle", title: "Ajuda e Suporte", color: .gray) {
                // Open help
            }

            MenuItem(icon: "info.circle", title: "Sobre", color: .gray) {
                // Open about
            }

            Divider()
                .padding(.leading, 60)

            MenuItem(icon: "arrow.right.square", title: "Sair", color: .red) {
                authManager.signOut()
            }
        }
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct MenuItem: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(color)
                    .frame(width: 30)

                Text(title)
                    .foregroundColor(.primary)

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
            .contentShape(Rectangle())
        }
    }
}

// MARK: - Profile ViewModel

@MainActor
class ProfileViewModel: ObservableObject {
    @Published var user: UserProfile?
    @Published var quickStats: [QuickStat] = []
    @Published var xpToNextLevel: Long = 1000

    private let userRepository = IosRepositoryFactory.shared.createUserRepository()
    private let statisticsRepository = IosRepositoryFactory.shared.createStatisticsRepository()

    func loadUserData() async {
        do {
            let user = try await userRepository.getCurrentUser()
            self.user = UserProfile(
                id: user.id,
                name: user.name,
                email: user.email,
                photoUrl: user.photoUrl,
                level: user.level,
                xp: user.xp,
                role: user.role
            )

            // Calcular XP para o próximo nível
            self.xpToNextLevel = LevelCalculator.xpForLevel(user.level + 1)

            // Carregar estatísticas
            await loadStatistics()
        } catch {
            print("Erro ao carregar usuário: \(error)")
        }
    }

    private func loadStatistics() async {
        do {
            guard let user = user else { return }

            async let gamesPlayed = statisticsRepository.getTotalGamesPlayed(userId: user.id)
            async let totalGoals = statisticsRepository.getTotalGoals(userId: user.id)
            async let totalAssists = statisticsRepository.getTotalAssists(userId: user.id)
            async let wins = statisticsRepository.getTotalWins(userId: user.id)

            let (games, goals, assists, totalWins) = try await (gamesPlayed, totalGoals, totalAssists, wins)

            self.quickStats = [
                QuickStat(icon: "soccerball", label: "Jogos", value: games, color: .appPrimary),
                QuickStat(icon: "figure.run", label: "Gols", value: goals, color: .green),
                QuickStat(icon: "hand.tap", label: "Assists", value: assists, color: .blue),
                QuickStat(icon: "trophy", label: "Vitórias", value: totalWins, color: .gold)
            ]
        } catch {
            print("Erro ao carregar estatísticas: \(error)")
        }
    }
}

// MARK: - Models

struct UserProfile {
    let id: String
    let name: String
    let email: String
    let photoUrl: String?
    let level: Int
    let xp: Long
    let role: String
}

// MARK: - Settings View

struct SettingsView: View {
    @EnvironmentObject var themeManager: ThemeManager
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Aparência") {
                    Toggle("Modo Escuro", isOn: $themeManager.isDarkMode)
                        .onChange(of: themeManager.isDarkMode) { _, _ in
                            themeManager.toggleTheme()
                        }
                }

                Section("Notificações") {
                    Toggle("Lembretes de Jogos", isOn: .constant(true))
                    Toggle("Convites", isOn: .constant(true))
                    Toggle("Atualizações", isOn: .constant(false))
                }

                Section("Privacidade") {
                    Toggle("Perfil Buscável", isOn: .constant(true))
                    Button("Limpar Cache") {
                        // Clear cache
                    }
                }

                Section("Sobre") {
                    HStack {
                        Text("Versão")
                        Spacer()
                        Text("1.0.0")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Configurações")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Fechar") {
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Edit Profile View

struct EditProfileView: View {
    let user: UserProfile?
    @Environment(\.dismiss) var dismiss
    @State private var name: String
    @State private var isLoading = false

    init(user: UserProfile?) {
        self.user = user
        self._name = State(initialValue: user?.name ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Informações Pessoais") {
                    TextField("Nome", text: $name)
                }

                Section("Foto de Perfil") {
                    HStack {
                        Spacer()
                        Button("Alterar Foto") {
                            // Implementar seleção de foto
                        }
                        Spacer()
                    }
                }
            }
            .navigationTitle("Editar Perfil")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancelar") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Salvar") {
                        Task {
                            await saveProfile()
                        }
                    }
                    .disabled(name.isEmpty || isLoading)
                }
            }
        }
    }

    private func saveProfile() async {
        isLoading = true
        // Implementar salvamento
        isLoading = false
        dismiss()
    }
}

// MARK: - Level Journey View

struct LevelJourneyView: View {
    let user: UserProfile?
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    Text("Sua Jornada")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("Continue jogando para subir de nível!")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    // Níveis conquistados
                    ForEach(1...(user?.level ?? 1), id: \.self) { level in
                        LevelBadge(level: level, isUnlocked: true)
                    }

                    // Próximo nível
                    LevelBadge(level: (user?.level ?? 1) + 1, isUnlocked: false)
                }
                .padding()
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Jornada")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Fechar") {
                        dismiss()
                    }
                }
            }
        }
    }
}

struct LevelBadge: View {
    let level: Int
    let isUnlocked: Bool

    var body: some View {
        HStack {
            Image(systemName: isUnlocked ? "checkmark.circle.fill" : "lock.circle.fill")
                .foregroundColor(isUnlocked ? .appPrimary : .gray)

            Text("Nível \(level)")
                .font(.headline)

            Spacer()

            if isUnlocked {
                Text("Conquistado")
                    .font(.caption)
                    .foregroundColor(.appPrimary)
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Level Calculator (helper)

struct LevelCalculator {
    static func xpForLevel(_ level: Int) -> Long {
        // XP necessário para cada nível (fórmula do jogo)
        Long(level * 1000)
    }
}

// MARK: - Preview

#Preview {
    ProfileView()
}
