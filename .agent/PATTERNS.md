# Padrões de Projeto (Code Snippets)

## ViewModel State Setup

Padrão de UI State usando Sealed Class e StateFlow.

```kotlin
// UiState
sealed class FeatureUiState {
    object Loading : FeatureUiState()
    data class Success(val data: List<MyData>) : FeatureUiState()
    data class Error(val message: String) : FeatureUiState()
}

// ViewModel
@HiltViewModel
class MyViewModel @Inject constructor(
    private val repository: MyRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FeatureUiState>(FeatureUiState.Loading)
    val uiState: StateFlow<FeatureUiState> = _uiState

    fun loadData() {
        viewModelScope.launch {
            _uiState.value = FeatureUiState.Loading
            repository.getData()
                .onSuccess { data ->
                    _uiState.value = FeatureUiState.Success(data)
                }
                .onFailure { e ->
                    _uiState.value = FeatureUiState.Error(e.message ?: "Erro desconhecido")
                }
        }
    }
}
```

## Repository Pattern com Result

Padrão para métodos de repositório capturando exceções.

```kotlin
suspend fun doSomething(): Result<MyData> {
    return try {
        val result = apiOrDb.call()
        Result.success(result)
    } catch (e: Exception) {
        Result.failure(e)
    }
}
```

## Fragment Setup

Setup padrão de ViewBinding.

```kotlin
@AndroidEntryPoint
class MyFragment : Fragment() {

    private var _binding: FragmentMyBinding? = null
    private val binding get() = _binding!!

    private val viewModel: MyViewModel by viewModels()

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?
    ): View {
        _binding = FragmentMyBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        // Setup UI...
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
```
