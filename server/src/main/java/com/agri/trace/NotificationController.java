package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "15 通知中心")
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
  private final NotificationService notifications;
  private final AuthService auth;

  public NotificationController(NotificationService notifications, AuthService auth) {
    this.notifications = notifications;
    this.auth = auth;
  }

  @GetMapping
  public Map<String, Object> page(
      @RequestHeader(value = "Authorization", required = false) String header,
      @RequestParam(required = false) Integer status,
      @RequestParam(required = false) String channel,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    long uid = auth.requireUser(header);
    return Common.ok(notifications.page(uid, status, channel, page, size));
  }

  @GetMapping("/summary")
  public Map<String, Object> summary(@RequestHeader(value = "Authorization", required = false) String header) {
    long uid = auth.requireUser(header);
    return Common.ok(Common.map("unread", notifications.unread(uid)));
  }

  @PostMapping("/{id}/read")
  public Map<String, Object> read(
      @RequestHeader(value = "Authorization", required = false) String header,
      @PathVariable long id) {
    long uid = auth.requireUser(header);
    notifications.read(uid, id);
    return Common.ok(Common.map("unread", notifications.unread(uid)));
  }

  @PostMapping("/read-all")
  public Map<String, Object> readAll(@RequestHeader(value = "Authorization", required = false) String header) {
    long uid = auth.requireUser(header);
    return Common.ok(Common.map("updated", notifications.readAll(uid), "unread", notifications.unread(uid)));
  }
}
