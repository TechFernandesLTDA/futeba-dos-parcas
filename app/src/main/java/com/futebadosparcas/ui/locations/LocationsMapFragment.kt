package com.futebadosparcas.ui.locations

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.futebadosparcas.R
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.OnMapReadyCallback
import com.google.android.gms.maps.SupportMapFragment
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.MarkerOptions
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class LocationsMapFragment : Fragment(), OnMapReadyCallback {

    private val viewModel: LocationsMapViewModel by viewModels()
    private var googleMap: GoogleMap? = null

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_locations_map, container, false)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val mapFragment = childFragmentManager.findFragmentById(R.id.map) as SupportMapFragment?
        mapFragment?.getMapAsync(this)
        
        viewModel.loadLocations()
        observeViewModel()
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map
        // Default to Curitiba/Brazil or wait for location
        val startLoc = LatLng(-25.4284, -49.2733) // Curitiba
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(startLoc, 12f))
        
        // Setup markers if data arrived
        updateMarkers()
    }

    private fun observeViewModel() {
        // Observe locations from ViewModel
        // Need to create ViewModel first
         viewModel.locations.observe(viewLifecycleOwner) { locations ->
            updateMarkers()
        }
    }

    private fun updateMarkers() {
        val map = googleMap ?: return
        val locations = viewModel.locations.value ?: return

        map.clear()
        for (location in locations) {
            if (location.latitude != null && location.longitude != null) {
                val position = LatLng(location.latitude!!, location.longitude!!)
                map.addMarker(
                    MarkerOptions()
                        .position(position)
                        .title(location.name)
                        .snippet(location.address)
                )
            }
        }
    }
}
