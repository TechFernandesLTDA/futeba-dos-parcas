package com.futebadosparcas.ui.tactical

import android.content.Context
import android.graphics.*
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.View
import androidx.core.content.ContextCompat
import com.futebadosparcas.R
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class TacticalBoardView @JvmOverloads constructor(
    context: Context, attrs: AttributeSet? = null, defStyleAttr: Int = 0
) : View(context, attrs, defStyleAttr) {

    private var drawPath = Path()
    private var drawPaint = Paint()
    private var canvasPaint = Paint(Paint.DITHER_FLAG)
    private var drawCanvas: Canvas? = null
    private var canvasBitmap: Bitmap? = null

    private var paintColor = Color.BLACK
    private var strokeWidth = 10f

    // Store paths for Undo functionality (not fully implemented in MVP but structure is here)
    private val paths = ArrayList<Pair<Path, Int>>() 
    
    // Field Background
    private val fieldPaint = Paint().apply {
        color = Color.parseColor("#4CAF50") // Grass Green
        style = Paint.Style.FILL
    }
    private val linesPaint = Paint().apply {
        color = Color.WHITE
        style = Paint.Style.STROKE
        strokeWidth = 5f
    }

    init {
        setupDrawing()
    }

    private fun setupDrawing() {
        drawPaint.color = paintColor
        drawPaint.isAntiAlias = true
        drawPaint.strokeWidth = strokeWidth
        drawPaint.style = Paint.Style.STROKE
        drawPaint.strokeJoin = Paint.Join.ROUND
        drawPaint.strokeCap = Paint.Cap.ROUND
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        super.onSizeChanged(w, h, oldw, oldh)
        canvasBitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        drawCanvas = Canvas(canvasBitmap!!)
        drawField(drawCanvas!!)
    }

    override fun onDraw(canvas: Canvas) {
        canvas.drawBitmap(canvasBitmap!!, 0f, 0f, canvasPaint)
        canvas.drawPath(drawPath, drawPaint)
    }

    // Draw a simple soccer field
    private fun drawField(canvas: Canvas) {
        val width = width.toFloat()
        val height = height.toFloat()

        // Background
        canvas.drawRect(0f, 0f, width, height, fieldPaint)

        // Outer Lines
        val padding = 20f
        canvas.drawRect(padding, padding, width - padding, height - padding, linesPaint)

        // Center Line
        canvas.drawLine(padding, height / 2, width - padding, height / 2, linesPaint)

        // Center Circle
        canvas.drawCircle(width / 2, height / 2, width / 6, linesPaint)

        // Penalty Areas (Simplified)
        val goalWidth = width / 2.5f
        val areaHeight = height / 6
        
        // Top Area
        canvas.drawRect(
            (width - goalWidth) / 2, padding,
            (width + goalWidth) / 2, padding + areaHeight,
            linesPaint
        )

        // Bottom Area
        canvas.drawRect(
            (width - goalWidth) / 2, height - padding - areaHeight,
            (width + goalWidth) / 2, height - padding,
            linesPaint
        )
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        val touchX = event.x
        val touchY = event.y

        when (event.action) {
            MotionEvent.ACTION_DOWN -> {
                drawPath.moveTo(touchX, touchY)
            }
            MotionEvent.ACTION_MOVE -> {
                drawPath.lineTo(touchX, touchY)
            }
            MotionEvent.ACTION_UP -> {
                drawCanvas?.drawPath(drawPath, drawPaint)
                // Save path
                paths.add(Pair(Path(drawPath), paintColor))
                drawPath.reset()
            }
            else -> return false
        }
        invalidate()
        return true
    }

    fun setColor(newColor: Int) {
        invalidate()
        paintColor = newColor
        drawPaint.color = paintColor
    }

    fun setStrokeWidth(newWidth: Float) {
        strokeWidth = newWidth
        drawPaint.strokeWidth = strokeWidth
    }

    fun clear() {
        drawCanvas?.drawColor(0, PorterDuff.Mode.CLEAR)
        drawField(drawCanvas!!)
        paths.clear()
        invalidate()
    }
    
    fun saveBoard(): File? {
        val imagesDir = File(context.cacheDir, "images")
        if (!imagesDir.exists()) imagesDir.mkdirs()
        
        val filename = "tactical_board_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())}.jpg"
        val file = File(imagesDir, filename)
        return try {
            FileOutputStream(file).use { out ->
                canvasBitmap?.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }
            file
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
