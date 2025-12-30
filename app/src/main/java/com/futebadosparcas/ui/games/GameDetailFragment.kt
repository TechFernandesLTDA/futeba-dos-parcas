package com.futebadosparcas.ui.games

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import com.google.android.material.snackbar.Snackbar
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.navigation.fragment.navArgs
import androidx.recyclerview.widget.ConcatAdapter
import androidx.recyclerview.widget.LinearLayoutManager
import com.futebadosparcas.R
import com.futebadosparcas.databinding.FragmentGameDetailBinding
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch

@AndroidEntryPoint
class GameDetailFragment : Fragment() {

    private var _binding: FragmentGameDetailBinding? = null
    private val binding get() = _binding!!

    private val viewModel: GameDetailViewModel by viewModels()
    private val args: GameDetailFragmentArgs by navArgs()

    private lateinit var headerAdapter: GameDetailHeaderAdapter
    private var confirmationsAdapter: ConfirmationsAdapter? = null
    private var teamsAdapter: TeamsAdapter? = null
    private lateinit var concatAdapter: ConcatAdapter

    // Flag para evitar auto-navegação múltipla para votação
    private var hasNavigatedToVote: Boolean = false

    private val requestPermissionLauncher = registerForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { isGranted: Boolean ->
        if (isGranted) {
            getLastLocationAndStartGame()
        } else {
            showSnackbar("Permissão de localização é necessária para verificar se você está na quadra.", isError = true)
        }
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentGameDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupUI()
        setupAdapters()
        setupClickListeners()
        observeViewModel()

        viewModel.loadGameDetails(args.gameId)
    }

    private fun setupUI() {
        binding.toolbar.setNavigationOnClickListener {
            findNavController().popBackStack()
        }
        
        // Add Share Button
        binding.toolbar.menu.clear()
        binding.toolbar.inflateMenu(R.menu.game_detail_menu)
        binding.toolbar.setOnMenuItemClickListener { menuItem ->
            when (menuItem.itemId) {
                R.id.action_invite_whatsapp -> {
                    inviteToWhatsApp()
                    true
                }
                R.id.action_share -> {
                    shareGameDetails()
                    true
                }
                R.id.action_vote_mvp -> {
                    val action = GameDetailFragmentDirections.actionGameDetailToMvpVote(args.gameId)
                    findNavController().navigate(action)
                    true
                }
                R.id.action_share_card -> {
                    generateAndShareCard()
                    true
                }
                R.id.action_tactical_board -> {
                    val action = GameDetailFragmentDirections.actionGameDetailToTacticalBoard()
                    findNavController().navigate(action)
                    true
                }
                else -> false
            }
        }

        binding.rvContent.layoutManager = LinearLayoutManager(requireContext())
    }

    private var liveMatchSectionAdapter: LiveMatchAdapter? = null

    // ...

    private fun setupAdapters() {
        headerAdapter = GameDetailHeaderAdapter(
            onEditClick = {
                val action = GameDetailFragmentDirections.actionGameDetailToCreateGame(gameId = args.gameId)
                findNavController().navigate(action)
            },
            onCancelClick = { showCancelConfirmation() },
            onToggleStatus = { isChecked ->
                viewModel.toggleGameStatus(args.gameId, isChecked)
            },
            onStartGameClick = { getLastLocationAndStartGame() },
            onFinishGameClick = { showFinishGameDialog() },
            onLocationClick = { 
               val state = viewModel.uiState.value
               if (state is GameDetailUiState.Success) {
                   showLocationOptions(state.game)
               }
            },
            onGenerateTeamsClick = { showGenerateTeamsDialog() }
        )

        liveMatchSectionAdapter = LiveMatchAdapter(
            onAddEventClick = { eventType -> showAddEventDialog(eventType) },
            onDeleteEventClick = { event -> showDeleteEventConfirmation(event) }
        )

        teamsAdapter = TeamsAdapter(
            onPlayerClick = { playerId, sourceTeamId ->
                showMovePlayerDialog(playerId, sourceTeamId)
            },
            onPlayerMoved = { playerId, sourceTeamId, targetTeamId ->
                viewModel.movePlayer(playerId, sourceTeamId, targetTeamId)
            }
        )

        confirmationsAdapter = ConfirmationsAdapter(
            isOwner = false,
            currentUserId = null,
            onRemoveClick = { userId ->
                viewModel.removePlayer(args.gameId, userId)
            },
            onPaymentClick = { confirmation ->
                 // Logic transferred from previous initConfirmationsAdapter
                 val state = viewModel.uiState.value
                 if (state is GameDetailUiState.Success) {
                     val isOwner = state.canManageGame
                     val currentUserId = state.currentUserId
                     
                     if (isOwner && confirmation.userId != currentUserId) {
                         viewModel.togglePaymentStatus(args.gameId, confirmation.userId, confirmation.paymentStatus)
                     } else if (confirmation.paymentStatus == "PENDING") {
                         val price = state.game.dailyPrice
                         if (price > 0) {
                             val sheet = com.futebadosparcas.ui.payments.PaymentBottomSheetFragment.newInstance(args.gameId, price)
                              sheet.show(childFragmentManager, com.futebadosparcas.ui.payments.PaymentBottomSheetFragment.TAG)
                          } else {
                              showSnackbar("Jogo gratuito!")
                          }
                      }
                 }
            },
            onAcceptInvite = { confirmation ->
                val state = viewModel.uiState.value
                if (state is GameDetailUiState.Success) {
                    showPositionSelectionDialog(state)
                }
            },
            onDeclineInvite = { confirmation ->
                viewModel.toggleConfirmation(args.gameId)
            }
        )

        concatAdapter = ConcatAdapter(
            headerAdapter, 
            liveMatchSectionAdapter, 
            teamsAdapter, 
            confirmationsAdapter
        )
        binding.rvContent.adapter = concatAdapter
    }

    private fun showLocationOptions(game: com.futebadosparcas.data.model.Game) {
        val options = arrayOf("Abrir no Maps", "Copiar Endereço")
        AlertDialog.Builder(requireContext())
            .setTitle(game.locationName)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> openLocationInMaps(game)
                    1 -> copyAddressToClipboard(game)
                }
            }
            .show()
    }

    private fun copyAddressToClipboard(game: com.futebadosparcas.data.model.Game) {
        val address = if (game.locationAddress.isNotEmpty()) game.locationAddress else game.locationName
        val clipboard = requireContext().getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("Endereço do Jogo", address)
        clipboard.setPrimaryClip(clip)
        showSnackbar("Endereço copiado!")
    }

    private fun openLocationInMaps(game: com.futebadosparcas.data.model.Game) {
        val uri = if (game.locationLat != null && game.locationLng != null && game.locationLat != 0.0) {
            Uri.parse("geo:${game.locationLat},${game.locationLng}?q=${game.locationLat},${game.locationLng}(${Uri.encode(game.locationName)})")
        } else if (game.locationAddress.isNotEmpty()) {
            Uri.parse("geo:0,0?q=${Uri.encode(game.locationAddress)}")
        } else {
            showSnackbar("Localização não disponível", isError = true)
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, uri)
        intent.setPackage("com.google.android.apps.maps")
        try {
            startActivity(intent)
        } catch (e: Exception) {
             // Fallback if Maps is not installed
             startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
    }

    private fun setupClickListeners() {
        binding.btnConfirm.setOnClickListener {
            val uiState = viewModel.uiState.value
            if (uiState is GameDetailUiState.Success) {
                when {
                    uiState.isUserConfirmed -> {
                        viewModel.toggleConfirmation(args.gameId)
                    }
                    uiState.isUserPending || !uiState.isUserConfirmed -> {
                        showPositionSelectionDialog(uiState)
                    }
                }
            }
        }
    }

    private fun showPositionSelectionDialog(uiState: GameDetailUiState.Success) {
        // Contar goleiros e linha já confirmados
        val goalkeeperCount = uiState.confirmations.count {
            it.position == "GOALKEEPER" && it.status == "CONFIRMED"
        }
        val fieldCount = uiState.confirmations.count {
            it.position == "FIELD" && it.status == "CONFIRMED"
        }

        val dialog = PositionSelectionDialog.newInstance(
            goalkeeperCount = goalkeeperCount,
            fieldCount = fieldCount,
            maxGoalkeepers = 2,
            maxField = uiState.game.maxPlayers - 2
        ) { selectedPosition ->
            // Callback ao confirmar posição
            viewModel.confirmPresenceWithPosition(args.gameId, selectedPosition)
        }

        dialog.show(childFragmentManager, "PositionSelectionDialog")
    }

    /**
     * Envia convite direto pelo WhatsApp
     */
    private fun inviteToWhatsApp() {
        val uiState = viewModel.uiState.value
        if (uiState is GameDetailUiState.Success) {
            val game = uiState.game
            val confirmedCount = uiState.confirmations.count { it.status == "CONFIRMED" }

            val message = buildString {
                append("⚽ *Bora jogar bola!*\n\n")
                append("📅 *${game.date}* às *${game.time}*\n")
                append("📍 ${game.locationName}\n")
                if (game.fieldName.isNotEmpty()) append("🏟️ ${game.fieldName}\n")
                append("💰 ${if (game.dailyPrice > 0) "R$ %.2f".format(game.dailyPrice) else "Grátis"}\n")
                append("👥 $confirmedCount/${game.maxPlayers} confirmados\n\n")
                append("Confirma presença no app *Futeba dos Parças*!")
            }

            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse("https://wa.me/?text=${Uri.encode(message)}")
                }
                startActivity(intent)
            } catch (e: Exception) {
                showSnackbar("WhatsApp não instalado", isError = true)
                // Fallback para compartilhamento normal
                shareGameDetails()
            }
        }
    }

    private fun shareGameDetails() {
        val uiState = viewModel.uiState.value
        if (uiState is GameDetailUiState.Success) {
            val game = uiState.game
            val confirmedCount = uiState.confirmations.count { it.status == "CONFIRMED" }
            
            val sb = StringBuilder()
            sb.append("⚽ *Futeba dos Parças - Convite*\n\n")
            sb.append("📅 Data: ${game.date} às ${game.time}\n")
            sb.append("📍 Local: ${game.locationName}\n")
            if (game.fieldName.isNotEmpty()) sb.append("🏟️ Quadra: ${game.fieldName}\n")
            if (game.locationAddress.isNotEmpty()) sb.append("🗺️ Endereço: ${game.locationAddress}\n")
            sb.append("💰 Valor: ${if (game.dailyPrice > 0) "R$ %.2f".format(game.dailyPrice) else "Grátis"}\n")
            sb.append("👥 Confirmados: $confirmedCount/${game.maxPlayers}\n\n")
            
            val mapsLink = "https://www.google.com/maps/search/?api=1&query=${Uri.encode(game.locationAddress.ifEmpty { game.locationName })}"
            sb.append("🔗 Como chegar: $mapsLink\n\n")
            sb.append("Confirme sua presença no App!")

            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, sb.toString())
            }
            startActivity(Intent.createChooser(intent, "Compartilhar Jogo"))
        }
    }

    private fun generateAndShareCard() {
        val state = viewModel.uiState.value
        if (state is GameDetailUiState.Success) {
             val team1 = state.teams.getOrNull(0)
             val team2 = state.teams.getOrNull(1)
             
             if (team1 != null && team2 != null) {
                 val goals = state.events.filter { it.eventType == "GOAL" }
                 val team1Score = goals.count { it.teamId == team1.id }
                 val team2Score = goals.count { it.teamId == team2.id }
                 
                 com.futebadosparcas.util.ShareCardHelper.shareGameResult(
                     requireContext(),
                     state.game,
                     team1.name,
                     team2.name,
                     team1Score,
                      team2Score
                  )
              } else {
                  showSnackbar("Times não definidos.", isError = true)
              }
        }
    }

    private fun showCancelConfirmation() {
        AlertDialog.Builder(requireContext())
            .setTitle("Cancelar Jogo")
            .setMessage("Tem certeza que deseja cancelar este jogo? Todas as confirmações serão perdidas.")
            .setPositiveButton("Sim") { _, _ ->
                viewModel.deleteGame(args.gameId)
            }
            .setNegativeButton("Não", null)
            .show()
    }

    private fun showGenerateTeamsDialog() {
        val options = arrayOf("2 Times", "3 Times", "4 Times")
        var selectedItem = 0
        
        AlertDialog.Builder(requireContext())
            .setTitle("Gerar Times")
            .setSingleChoiceItems(options, selectedItem) { _, which ->
                selectedItem = which
            }
            .setPositiveButton("Gerar") { _, _ ->
                val numberOfTeams = selectedItem + 2
                 AlertDialog.Builder(requireContext())
                    .setTitle("Equilibrar Times?")
                    .setMessage("Deseja equilibrar os times com base na avaliação dos jogadores?")
                    .setPositiveButton("Sim") { _, _ ->
                        viewModel.generateTeams(args.gameId, numberOfTeams, true)
                    }
                    .setNegativeButton("Não (Aleatório)") { _, _ ->
                        viewModel.generateTeams(args.gameId, numberOfTeams, false)
                    }
                    .show()
            }
            .setNeutralButton("Limpar Times") { _, _ -> 
                viewModel.clearTeams(args.gameId)
            }
            .show()
    }

    private fun showFinishGameDialog() {
        val state = viewModel.uiState.value
        if (state !is GameDetailUiState.Success) return

        val confirmedPlayers = state.confirmations.filter { it.status == "CONFIRMED" }
        
        if (confirmedPlayers.isEmpty()) {
            showSnackbar("Não há jogadores confirmados para eleger MVP.", isError = true)
        }

        val teamAName = state.teams.getOrNull(0)?.name ?: "Time A"
        val teamBName = state.teams.getOrNull(1)?.name ?: "Time B"
        
        val teamAScore = state.teams.getOrNull(0)?.score ?: 0
        val teamBScore = state.teams.getOrNull(1)?.score ?: 0
        
        val mvpCandidates = confirmedPlayers.map { Pair(it.userId, it.userName) }

        val dialog = FinishGameDialogFragment()
        dialog.setArgs(
            teamAName = teamAName, 
            teamBName = teamBName, 
            scoreA = teamAScore, 
            scoreB = teamBScore, 
            events = state.events,
            candidates = mvpCandidates
        ) { scoreA, scoreB, mvpId ->
            viewModel.finishGame(args.gameId, scoreA, scoreB, mvpId) 
        }
        dialog.show(childFragmentManager, FinishGameDialogFragment.TAG)
    }

    // Lazy init confirmations adapter
    // initConfirmationsAdapter removed


    private fun showMovePlayerDialog(playerId: String, sourceTeamId: String) {
        val state = viewModel.uiState.value
        if (state !is GameDetailUiState.Success) return
        
        val playerConf = state.confirmations.find { it.userId == playerId } ?: return
        val otherTeams = state.teams.filter { it.id != sourceTeamId }
        
        if (otherTeams.isEmpty()) {
            showSnackbar("Sem outros times para mover.", isError = true)
            return
        }
        
        val teamNames = otherTeams.map { it.name }.toTypedArray()
        
        AlertDialog.Builder(requireContext())
            .setTitle("Mover ${playerConf.userName} para:")
            .setItems(teamNames) { _, index ->
                val targetTeam = otherTeams[index]
                viewModel.movePlayer(playerId, sourceTeamId, targetTeam.id)
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }

    private fun showAddEventDialog(eventType: com.futebadosparcas.data.model.GameEventType) {
        val state = viewModel.uiState.value
        if (state !is GameDetailUiState.Success) return

        val teams = state.teams
        if (teams.isEmpty()) {
            showSnackbar("É necessário gerar times antes de iniciar a partida.", isError = true)
            return
        }

        val teamNames = teams.map { it.name }.toTypedArray()
        AlertDialog.Builder(requireContext())
            .setTitle("Para qual time?")
            .setItems(teamNames) { _, teamIndex ->
                val selectedTeam = teams[teamIndex]
                
                // Select Player Logic
                val teamPlayerIds = selectedTeam.playerIds
                val allTeamPlayers = state.confirmations.filter { it.userId in teamPlayerIds }

                // Filter for SAVE events (Goalkeepers only)
                val teamPlayers = if (eventType == com.futebadosparcas.data.model.GameEventType.SAVE) {
                     val gks = allTeamPlayers.filter { it.position == "GOALKEEPER" }
                      if (gks.isNotEmpty()) gks else {
                          showSnackbar("Nenhum goleiro definido, mostrando todos.")
                          allTeamPlayers
                      }
                } else {
                    allTeamPlayers
                }

                val playerNames = teamPlayers.map { it.userName }.toTypedArray()

                if (playerNames.isEmpty()) {
                    showSnackbar("Sem jogadores neste time.", isError = true)
                } else {
                    AlertDialog.Builder(requireContext())
                        .setTitle("Quem?")
                        .setItems(playerNames) { _, playerIndex ->
                            val selectedPlayer = teamPlayers[playerIndex]
                            
                            if (eventType == com.futebadosparcas.data.model.GameEventType.GOAL) {
                                // Ask for Assist
                                AlertDialog.Builder(requireContext())
                                    .setTitle("Houve assistência?")
                                    .setPositiveButton("Sim") { _, _ ->
                                        // Candidates excluding scorer
                                        val assistCandidates = teamPlayers.filter { it.userId != selectedPlayer.userId }
                                        val assistNames = assistCandidates.map { it.userName }.toTypedArray()
                                        
                                        if (assistNames.isNotEmpty()) {
                                            AlertDialog.Builder(requireContext())
                                                .setTitle("Quem deu o passe?")
                                                .setItems(assistNames) { _, assistIndex ->
                                                    val assistant = assistCandidates[assistIndex]
                                                    viewModel.sendGameEvent(
                                                        eventType = eventType,
                                                        teamId = selectedTeam.id,
                                                        playerId = selectedPlayer.userId,
                                                        playerName = selectedPlayer.userName,
                                                        assistedById = assistant.userId,
                                                        assistedByName = assistant.userName
                                                    )
                                                }
                                                .show()
                                        } else {
                                            // Fallback
                                            viewModel.sendGameEvent(eventType, selectedTeam.id, selectedPlayer.userId, selectedPlayer.userName)
                                        }
                                    }
                                    .setNegativeButton("Não") { _, _ ->
                                        viewModel.sendGameEvent(eventType, selectedTeam.id, selectedPlayer.userId, selectedPlayer.userName)
                                    }
                                    .show()
                            } else {
                                // Card or other
                                viewModel.sendGameEvent(eventType, selectedTeam.id, selectedPlayer.userId, selectedPlayer.userName)
                            }
                        }
                        .show()
                }
            }
            .show()
    }

    private fun showDeleteEventConfirmation(event: com.futebadosparcas.data.model.GameEvent) {
        AlertDialog.Builder(requireContext())
            .setTitle("Excluir Evento")
            .setMessage("Deseja desfazer este evento?")
            .setPositiveButton("Sim") { _, _ ->
                viewModel.deleteGameEvent(event.id)
            }
            .setNegativeButton("Não", null)
            .show()
    }

    private fun getLastLocationAndStartGame() {
        if (androidx.core.app.ActivityCompat.checkSelfPermission(
                requireContext(),
                android.Manifest.permission.ACCESS_FINE_LOCATION
            ) != android.content.pm.PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissionLauncher.launch(android.Manifest.permission.ACCESS_FINE_LOCATION)
            return
        }

        showSnackbar("Verificando sua localização...")
        
        val client = com.google.android.gms.location.LocationServices.getFusedLocationProviderClient(requireActivity())
        
        // Tenta obter localização atual (Alta precisão)
        client.getCurrentLocation(com.google.android.gms.location.Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { location ->
                 if (location != null) {
                     viewModel.startGame(args.gameId, location.latitude, location.longitude)
                 } else {
                     // Fallback para última localização
                     client.lastLocation.addOnSuccessListener { lastLoc ->
                         viewModel.startGame(args.gameId, lastLoc?.latitude, lastLoc?.longitude)
                     }
                 }
            }
            .addOnFailureListener {
                 viewModel.startGame(args.gameId, null, null)
            }
    }

    // ...

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is GameDetailUiState.Loading -> {
                        binding.progressBar.visibility = View.VISIBLE
                        binding.rvContent.visibility = View.GONE
                    }
                    is GameDetailUiState.Success -> {
                        binding.progressBar.visibility = View.GONE
                        binding.rvContent.visibility = View.VISIBLE

                        // Show transient message if any
                        state.userMessage?.let { msg ->
                            showSnackbar(msg)
                            viewModel.clearUserMessage()
                        }

                        // Handle Automated Scheduling Feedback
                        state.schedulingEvent?.let { event ->
                            when (event) {
                                is SchedulingEvent.Success -> {
                                    showSnackbar("⚽ Próximo jogo agendado: ${event.nextDate}")
                                }
                                is SchedulingEvent.Conflict -> {
                                    showSnackbar("⚠️ Conflito! Não foi possível agendar o jogo em ${event.date}.", isError = true)
                                }
                                is SchedulingEvent.Error -> {
                                    showSnackbar("❌ Erro no agendamento automático: ${event.message}", isError = true)
                                }
                            }
                            viewModel.clearSchedulingEvent()
                        }

                        // Auto-Navigate to MVP Vote if finished and not voted - apenas uma vez
                        if (state.game.status == "FINISHED" && state.hasVoted == false && !hasNavigatedToVote) {
                            // Check if current destination is GameDetail to avoid repeated nav attempts or crashes
                            if (findNavController().currentDestination?.id == R.id.gameDetailFragment) {
                                hasNavigatedToVote = true
                                val action = GameDetailFragmentDirections.actionGameDetailToMvpVote(state.game.id)
                                findNavController().navigate(action)
                            }
                        }

                        // Update Adapters
                        headerAdapter.updateGame(state.game, state.canManageGame, state.confirmations.size, state.confirmations, state.currentUserId)

                        // Update Menu Visibility
                        val mvpItem = binding.toolbar.menu.findItem(R.id.action_vote_mvp)
                        mvpItem?.isVisible = (state.game.status == "FINISHED")

                        val shareCardItem = binding.toolbar.menu.findItem(R.id.action_share_card)
                        shareCardItem?.isVisible = (state.game.status == "FINISHED")
                        
                        // Show/Hide Live Match Section based on game status
                        val isLiveOrFinished = state.game.status == "LIVE" || state.game.status == "FINISHED"
                        if (isLiveOrFinished) {
                            liveMatchSectionAdapter?.updateData(state.game, state.teams, state.events, state.confirmations)
                            // Allow updating permission if needed, though usually static per session
                            liveMatchSectionAdapter?.setCanLogEvents(state.canLogEvents) 
                        } else {
                            liveMatchSectionAdapter?.updateData(null, emptyList(), emptyList())
                        }
                        
                        teamsAdapter?.submitList(state.teams)
                        teamsAdapter?.updateConfirmations(state.confirmations)
                        teamsAdapter?.setOwner(state.canManageGame)
                        
                        confirmationsAdapter?.submitList(state.confirmations)
                        confirmationsAdapter?.setOwner(state.canManageGame)
                        confirmationsAdapter?.setCurrentUserId(state.currentUserId)

                        // Update fixed bottom button
                        when {
                            state.isUserConfirmed -> {
                                binding.btnConfirm.text = "Cancelar Confirmação"
                                binding.btnConfirm.setBackgroundColor(
                                    requireContext().getColor(R.color.error)
                                )
                            }
                            state.isUserPending -> {
                                binding.btnConfirm.text = "Aceitar Convite"
                                binding.btnConfirm.setBackgroundColor(
                                    requireContext().getColor(R.color.success)
                                )
                            }
                            else -> {
                                binding.btnConfirm.text = "Confirmar Presença"
                                binding.btnConfirm.setBackgroundColor(
                                    requireContext().getColor(R.color.primary)
                                )
                            }
                        }
                    }
                    is GameDetailUiState.GameDeleted -> {
                        binding.progressBar.visibility = View.GONE
                        showSnackbar("Jogo cancelado com sucesso")
                        findNavController().popBackStack()
                    }
                    is GameDetailUiState.Error -> {
                        binding.progressBar.visibility = View.GONE
                        showSnackbar(state.message, isError = true)
                    }
                }
            }
        }
    }

    private fun showSnackbar(message: String, isError: Boolean = false) {
        val snackbar = Snackbar.make(binding.root, message, Snackbar.LENGTH_LONG)
        if (isError) {
            snackbar.setBackgroundTint(requireContext().getColor(R.color.error))
            snackbar.setTextColor(requireContext().getColor(R.color.on_error))
        }
        snackbar.show()
    }
    
    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
        confirmationsAdapter = null
        teamsAdapter = null
        liveMatchSectionAdapter = null
    }
}
