package com.futebadosparcas.ui.auth

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.futebadosparcas.databinding.ActivityRegisterBinding
import dagger.hilt.android.AndroidEntryPoint

// Nota: Registro agora e feito via Google Sign-In
// Esta Activity redireciona para o Login

@AndroidEntryPoint
class RegisterActivity : AppCompatActivity() {

    private lateinit var binding: ActivityRegisterBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityRegisterBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Informar usuario e voltar ao Login
        Toast.makeText(
            this,
            "Use o botao 'Entrar com Google' para criar sua conta",
            Toast.LENGTH_LONG
        ).show()

        finish()
    }
}
