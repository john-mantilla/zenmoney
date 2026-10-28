import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNotifications = {
  scheduleNotificationAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  dismissNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  SchedulableTriggerInputTypes: {
    TIME_INTERVAL: 'timeInterval',
  },
};

vi.mock('expo-notifications', () => mockNotifications);

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('../services/BudgetAlertService', () => ({
  BudgetAlertService: {
    requestPermissions: vi.fn().mockResolvedValue(true),
  },
}));

import { RegistrationReminderService, INACTIVITY_REMINDER_ID } from '../services/RegistrationReminderService';

describe('RegistrationReminderService (Deduplicación & Identificador Único)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotifications.scheduleNotificationAsync.mockResolvedValue('zenmoney-inactivity-reminder');
    mockNotifications.cancelScheduledNotificationAsync.mockResolvedValue(undefined);
    mockNotifications.dismissNotificationAsync.mockResolvedValue(undefined);
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
    RegistrationReminderService.setNotificationModule(mockNotifications);
    // Reset internal state if any
    (RegistrationReminderService as any).lastScheduledAt = 0;
    (RegistrationReminderService as any).isScheduling = false;
  });

  it('programa la notificación usando el identificador determinista INACTIVITY_REMINDER_ID', async () => {
    await RegistrationReminderService.scheduleInactivityReminder(2);

    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: INACTIVITY_REMINDER_ID,
        content: expect.objectContaining({
          title: expect.stringContaining('¿Olvidaste anotar algún gasto?'),
        }),
      })
    );
  });

  it('evita llamadas duplicadas en ráfaga gracias al debounce y mutex', async () => {
    // Disparar 5 llamadas concurrentes idénticas
    await Promise.all([
      RegistrationReminderService.scheduleInactivityReminder(2),
      RegistrationReminderService.scheduleInactivityReminder(2),
      RegistrationReminderService.scheduleInactivityReminder(2),
      RegistrationReminderService.scheduleInactivityReminder(2),
      RegistrationReminderService.scheduleInactivityReminder(2),
    ]);

    // Solo se debe haber programado exactamente una vez
    expect(mockNotifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('onAppOpened descarta la notificación visible de la bandeja', async () => {
    await RegistrationReminderService.onAppOpened();
    expect(mockNotifications.dismissNotificationAsync).toHaveBeenCalledWith(INACTIVITY_REMINDER_ID);
  });

  it('cancelExisting cancela por identificador y limpia notificaciones huérfanas', async () => {
    mockNotifications.getAllScheduledNotificationsAsync.mockResolvedValue([
      { identifier: 'orphan-1', content: { title: '🧾 ¿Olvidaste anotar algún gasto?' } },
      { identifier: 'other-notif', content: { title: 'Factura por vencer' } },
    ]);

    await RegistrationReminderService.cancelExisting();

    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(INACTIVITY_REMINDER_ID);
    expect(mockNotifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('orphan-1');
    expect(mockNotifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('other-notif');
  });
});
