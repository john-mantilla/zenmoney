package com.zenmoney.app.widget

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.zenmoney.app.R

class QuickAddWidget : GlanceAppWidget() {

    companion object {
        const val PREFS_NAME = "zenmoney_widget_prefs"
        const val KEY_REMAINING_BUDGET = "remaining_budget"
        const val KEY_BUDGET_STATUS = "budget_status"
        const val KEY_SPENT_PERCENTAGE = "spent_percentage"
    }

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val remainingBudget = prefs.getString(KEY_REMAINING_BUDGET, "$ --") ?: "$ --"
        val budgetStatus = prefs.getString(KEY_BUDGET_STATUS, "Presupuesto Disponible") ?: "Presupuesto Disponible"

        val expenseIntent = Intent(Intent.ACTION_VIEW, Uri.parse("zenmoney://transaction/new?type=expense")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val cameraIntent = Intent(Intent.ACTION_VIEW, Uri.parse("zenmoney://transaction/new?action=camera")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        val appIntent = Intent(Intent.ACTION_VIEW, Uri.parse("zenmoney://budgets")).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        provideContent {
            WidgetContent(
                remainingBudget = remainingBudget,
                budgetStatus = budgetStatus,
                expenseIntent = expenseIntent,
                cameraIntent = cameraIntent,
                appIntent = appIntent
            )
        }
    }

    @androidx.compose.runtime.Composable
    private fun WidgetContent(
        remainingBudget: String,
        budgetStatus: String,
        expenseIntent: Intent,
        cameraIntent: Intent,
        appIntent: Intent
    ) {
        val bgDark = Color(0xFF0F172A)      // Slate 900
        val cardBg = Color(0xFF1E293B)      // Slate 800
        val emerald = Color(0xFF10B981)     // Emerald 500
        val textMuted = Color(0xFF94A3B8)   // Slate 400
        val white = Color(0xFFFFFFFF)
        val primaryBtn = Color(0xFF16A34A)  // Green 600

        Box(
            modifier = GlanceModifier
                .fillMaxSize()
                .background(ColorProvider(bgDark))
                .cornerRadius(18.dp)
                .padding(10.dp),
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = GlanceModifier
                    .fillMaxSize()
                    .background(ColorProvider(cardBg))
                    .cornerRadius(14.dp)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // SECCIÓN IZQUIERDA: Presupuesto Disponible (Tocar abre Budgets)
                Column(
                    modifier = GlanceModifier
                        .defaultWeight()
                        .fillMaxHeight()
                        .clickable(actionStartActivity(appIntent)),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Image(
                            provider = ImageProvider(R.drawable.ic_widget_wallet),
                            contentDescription = "Wallet",
                            modifier = GlanceModifier.size(14.dp)
                        )
                        Spacer(modifier = GlanceModifier.width(4.dp))
                        Text(
                            text = "DISPONIBLE",
                            style = TextStyle(
                                color = ColorProvider(emerald),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }

                    Spacer(modifier = GlanceModifier.height(2.dp))

                    Text(
                        text = remainingBudget,
                        style = TextStyle(
                            color = ColorProvider(white),
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold
                        ),
                        maxLines = 1
                    )

                    Text(
                        text = budgetStatus,
                        style = TextStyle(
                            color = ColorProvider(textMuted),
                            fontSize = 10.sp
                        ),
                        maxLines = 1
                    )
                }

                Spacer(modifier = GlanceModifier.width(8.dp))

                // SECCIÓN DERECHA: Acciones Rápidas (+ Gasto y Cámara)
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Botón 1: + Gasto rápido
                    Row(
                        modifier = GlanceModifier
                            .background(ColorProvider(primaryBtn))
                            .cornerRadius(10.dp)
                            .padding(horizontal = 10.dp, vertical = 8.dp)
                            .clickable(actionStartActivity(expenseIntent)),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Image(
                            provider = ImageProvider(R.drawable.ic_widget_add),
                            contentDescription = "Nuevo Gasto",
                            modifier = GlanceModifier.size(16.dp)
                        )
                        Spacer(modifier = GlanceModifier.width(4.dp))
                        Text(
                            text = "Gasto",
                            style = TextStyle(
                                color = ColorProvider(white),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }

                    Spacer(modifier = GlanceModifier.width(6.dp))

                    // Botón 2: Cámara para escanear recibos
                    Box(
                        modifier = GlanceModifier
                            .size(36.dp)
                            .background(ColorProvider(Color(0xFF334155))) // Slate 700
                            .cornerRadius(10.dp)
                            .clickable(actionStartActivity(cameraIntent)),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            provider = ImageProvider(R.drawable.ic_widget_camera),
                            contentDescription = "Escanear Recibo",
                            modifier = GlanceModifier.size(18.dp)
                        )
                    }
                }
            }
        }
    }
}
