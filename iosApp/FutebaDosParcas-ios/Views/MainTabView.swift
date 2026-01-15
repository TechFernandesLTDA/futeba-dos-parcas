//
//  MainTabView.swift
//  Futeba dos Parças - iOS
//
//  Tab bar principal com navegação para as telas principais
//

import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            HomeView()
                .tabItem {
                    Label("Início", systemImage: selectedTab == 0 ? "house.fill" : "house")
                }
                .tag(0)

            GamesView()
                .tabItem {
                    Label("Jogos", systemImage: selectedTab == 1 ? "soccerball.fill" : "soccerball")
                }
                .tag(1)

            RankingsView()
                .tabItem {
                    Label("Ranking", systemImage: selectedTab == 2 ? "trophy.fill" : "trophy")
                }
                .tag(2)

            ProfileView()
                .tabItem {
                    Label("Perfil", systemImage: selectedTab == 3 ? "person.fill" : "person")
                }
                .tag(3)
        }
        .accentColor(.appPrimary)
    }
}

// MARK: - Preview

#Preview {
    MainTabView()
}
