//
//  VerificationFlowView.swift
//  Futeba dos Parças - iOS
//
//  Coordinator do fluxo de onboarding Phone+CPF (Fase 4 iOS).
//  Roteia entre PhoneVerificationView → CpfVerificationView → completion.
//
//  Issue: #447
//

import SwiftUI
import FirebaseAuth

struct VerificationFlowView: View {
    enum Stage {
        case phone
        case cpf
        case completed
    }

    @State private var stage: Stage
    let onCompleted: () -> Void

    init(initialStage: Stage = .phone, onCompleted: @escaping () -> Void) {
        // Auto-skip phone se Firebase Auth já tem phoneNumber linked
        let initial: Stage
        if Auth.auth().currentUser?.phoneNumber != nil {
            initial = .cpf
        } else {
            initial = initialStage
        }
        self._stage = State(initialValue: initial)
        self.onCompleted = onCompleted
    }

    var body: some View {
        Group {
            switch stage {
            case .phone:
                PhoneVerificationView(onCompleted: {
                    stage = .cpf
                })
            case .cpf:
                CpfVerificationView(onCompleted: {
                    stage = .completed
                    onCompleted()
                })
            case .completed:
                ProgressView("Redirecionando…")
                    .padding()
            }
        }
    }
}
