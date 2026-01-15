//
//  GamesView.swift
//  Futeba dos Parças - iOS
//
//  Tela de listagem de jogos
//

import SwiftUI

enum GameFilter: String, CaseIterable {
    case all = "Todos"
    case upcoming = "Próximos"
    case history = "Histórico"
    case live = "Ao Vivo"
}

struct GamesView: View {
    @StateObject private var viewModel = GamesViewModel()
    @State private var selectedFilter: GameFilter = .upcoming
    @State private var showingCreateGame = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Filtros
                FilterPicker(
                    selected: $selectedFilter,
                    options: GameFilter.allCases
                )
                .padding(.horizontal)
                .padding(.top, 8)
                .background(Color(uiColor: .systemGroupedBackground))

                // Conteúdo
                Group {
                    if viewModel.isLoading && viewModel.games.isEmpty {
                        LoadingView()
                    } else if viewModel.games.isEmpty {
                        EmptyGamesView(filter: selectedFilter)
                    } else {
                        GamesList(games: viewModel.games)
                    }
                }
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Jogos")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showingCreateGame = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .sheet(isPresented: $showingCreateGame) {
                CreateGameView()
            }
            .onChange(of: selectedFilter) { _, newFilter in
                viewModel.updateFilter(newFilter)
            }
        }
        .task {
            await viewModel.loadGames()
        }
    }
}

// MARK: - Filter Picker

struct FilterPicker: View {
    @Binding var selected: GameFilter
    let options: [GameFilter]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(options, id: \.self) { option in
                    FilterButton(
                        title: option.rawValue,
                        isSelected: selected == option
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            selected = option
                        }
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }
}

struct FilterButton: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline)
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.appPrimary : Color(uiColor: .tertiarySystemGroupedBackground))
                .foregroundColor(isSelected ? .white : .primary)
                .clipShape(Capsule())
        }
    }
}

// MARK: - Games List

struct GamesList: View {
    let games: [Game]

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(games) { game in
                    NavigationLink {
                        GameDetailView(gameId: game.id)
                    } label: {
                        GameRowCard(game: game)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }
            .padding()
        }
    }
}

// MARK: - Game Row Card

struct GameRowCard: View {
    let game: Game

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(game.formattedDate)
                        .font(.caption)
                        .foregroundColor(.secondary)

                    Text(game.formattedTime)
                        .font(.title3)
                        .fontWeight(.semibold)
                }

                Spacer()

                StatusBadge(status: game.status)

                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(game.confirmedPlayers.count)")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(.appPrimary)

                    Text("de \(game.maxPlayers)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Divider()

            HStack {
                Image(systemName: "mappin.circle.fill")
                    .foregroundColor(.appPrimary)

                Text(game.locationName)
                    .font(.subheadline)
                    .lineLimit(1)

                Spacer()
            }

            // Avatares dos confirmados
            if !game.confirmedPlayers.isEmpty {
                HStack {
                    HStack(spacing: -8) {
                        ForEach(game.confirmedPlayers.prefix(6), id: \.id) { player in
                            AsyncImage(url: URL(string: player.photoUrl ?? "")) {
                                $0.resizable()
                            } placeholder: {
                                Circle()
                                    .fill(Color.appSecondary.opacity(0.3))
                            }
                            .frame(width: 28, height: 28)
                            .clipShape(Circle())
                            .overlay(
                                Circle().stroke(Color(uiColor: .systemBackground), lineWidth: 2)
                            )
                        }

                        if game.confirmedPlayers.count > 6 {
                            Text("+\(game.confirmedPlayers.count - 6)")
                                .font(.caption2)
                                .fontWeight(.medium)
                                .foregroundColor(.secondary)
                        }
                    }

                    Spacer()

                    Text(game.playersNeeded > 0 ? "Faltam \(game.playersNeeded)" : "Completo")
                        .font(.caption)
                        .foregroundColor(game.playersNeeded > 0 ? .orange : .green)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(
                            (game.playersNeeded > 0 ? Color.orange : Color.green).opacity(0.2)
                        )
                        .clipShape(Capsule())
                }
            }
        }
        .padding()
        .background(Color(uiColor: .secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Empty Games View

struct EmptyGamesView: View {
    let filter: GameFilter

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: emptyIcon)
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text(emptyTitle)
                .font(.headline)
                .foregroundColor(.primary)

            Text(emptyMessage)
                .font(.subheadline)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private var emptyIcon: String {
        switch filter {
        case .all, .upcoming: return "calendar.badge.plus"
        case .history: return "clock.arrow.circlepath"
        case .live: return "soccerball"
        }
    }

    private var emptyTitle: String {
        switch filter {
        case .all, .upcoming: return "Nenhum jogo agendado"
        case .history: return "Nenhum jogo realizado"
        case .live: return "Nenhum jogo ao vivo"
        }
    }

    private var emptyMessage: String {
        switch filter {
        case .all, .upcoming:
            return "Organize um jogo com seus amigos!\nToque no + para criar."
        case .history:
            return "Os jogos finalizados aparecerão aqui."
        case .live:
            return "Não há jogos acontecendo agora."
        }
    }
}

// MARK: - Loading View

struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.5)

            Text("Carregando jogos...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Game Extensions

extension Game {
    var playersNeeded: Int {
        max(0, maxPlayers - confirmedPlayers.count)
    }
}

// MARK: - Preview

#Preview {
    GamesView()
}
