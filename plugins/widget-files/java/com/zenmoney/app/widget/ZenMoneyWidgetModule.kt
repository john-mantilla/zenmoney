package com.zenmoney.app.widget

import android.content.Context
import androidx.glance.appwidget.updateAll
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class ZenMoneyWidgetModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ZenMoneyWidgetModule"

    @ReactMethod
    fun updateWidgetData(
        remainingBudget: String,
        budgetStatus: String,
        spentPercentage: Double,
        promise: Promise
    ) {
        try {
            val prefs = reactContext.getSharedPreferences(QuickAddWidget.PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit().apply {
                putString(QuickAddWidget.KEY_REMAINING_BUDGET, remainingBudget)
                putString(QuickAddWidget.KEY_BUDGET_STATUS, budgetStatus)
                putFloat(QuickAddWidget.KEY_SPENT_PERCENTAGE, spentPercentage.toFloat())
                apply()
            }

            // Disparar actualización de Glance en segundo plano
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    QuickAddWidget().updateAll(reactContext)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WIDGET_UPDATE_ERROR", e.message, e)
        }
    }
}
