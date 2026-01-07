# ViewModel Patterns

Padrões para ViewModels no projeto Futeba dos Parças.

## Estrutura Básica

```kotlin
@HiltViewModel
class FeatureViewModel @Inject constructor(
    private val repository: FeatureRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<FeatureUiState>(FeatureUiState.Loading)
    val uiState: StateFlow<FeatureUiState> = _uiState

    private var loadJob: Job? = null

    fun loadData() {
        loadJob?.cancel()  // Cancelar job anterior
        loadJob = viewModelScope.launch {
            // ...
        }
    }

    override fun onCleared() {
        super.onCleared()
        loadJob?.cancel()
    }
}
```

## Sealed Classes para UI State

```kotlin
sealed class FeatureUiState {
    object Loading : FeatureUiState()
    data class Success(val data: Data) : FeatureUiState()
    data class Error(val message: String) : FeatureUiState()
}
```

## Job Tracking

- **SEMPRE** armazenar referência do Job
- **SEMPRE** cancelar job anterior antes de iniciar novo
- **SEMPRE** cancelar jobs em `onCleared()`

## Flow Collection

```kotlin
viewModelScope.launch {
    repository.getDataFlow()
        .catch { e ->
            _uiState.value = FeatureUiState.Error(e.message ?: "Erro")
        }
        .collect { data ->
            _uiState.value = FeatureUiState.Success(data)
        }
}
```

## Parallel Loading

```kotlin
viewModelScope.launch {
    val data1 = async { repository.getData1() }
    val data2 = async { repository.getData2() }

    val results = awaitAll(data1, data2)
    // Process results
}
```

## Error Handling

- **SEMPRE** usar `.catch {}` em Flow collections
- Expor erros via UiState, não exceptions
- Usar `Result<T>` para operações únicas
