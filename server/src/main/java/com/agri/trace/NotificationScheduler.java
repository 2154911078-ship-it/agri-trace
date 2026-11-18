package com.agri.trace;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class NotificationScheduler {
  private final NotificationService notifications;

  public NotificationScheduler(NotificationService notifications) {
    this.notifications = notifications;
  }

  @Scheduled(fixedDelay = 60000, initialDelay = 30000)
  public void escalate() {
    try {
      notifications.escalateOverdue();
    } catch (Exception ignored) {
    }
  }
}
