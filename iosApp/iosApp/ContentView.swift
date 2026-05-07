import SwiftUI
import shared

/// Smoke screen — valida que o iOS app linka contra o `shared` framework KMP.
/// Vai ser substituído pelo `composeApp/MainViewController` quando Phase 3 do CMP
/// implementar a UI compartilhada (pendente).
///
/// Este placeholder exibe a versão da plataforma vinda do shared (Platform expect/actual)
/// para confirmar que o KMP framework está integrado corretamente.
struct ContentView: View {
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "soccerball")
                .imageScale(.large)
                .foregroundStyle(.tint)
                .font(.system(size: 80))

            Text("Futeba dos Parças")
                .font(.largeTitle)
                .bold()

            Text("iOS Smoke Test")
                .font(.headline)
                .foregroundStyle(.secondary)

            Divider()
                .padding(.horizontal)

            Text("Plataforma: \(Platform().name)")
                .font(.body)
                .padding()
                .background(Color.gray.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))

            Text("Shared framework integrado ✓")
                .font(.caption)
                .foregroundStyle(.green)

            Text("Próximo: Phase 3 CMP (UI compartilhada)")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.top)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
