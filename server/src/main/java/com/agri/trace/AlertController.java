package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "10 预警")
@RestController
@RequestMapping("/api/alerts")
public class AlertController {
  private final AlertService alerts;
  private final AuthService auth;
  private final NotificationService notifications;

  public AlertController(AlertService alerts, AuthService auth, NotificationService notifications) {
    this.alerts = alerts;
    this.auth = auth;
    this.notifications = notifications;
  }

  @GetMapping
  public Map<String, Object> page(
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) Integer status,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(alerts.page(kw, status, farmId, page, size));
  }

  @PostMapping("/{id}/ack")
  public Map<String, Object> ack(
      @PathVariable long id,
      @RequestHeader(value = "Authorization", required = false) String header) {
    long uid = auth.requireUser(header);
    return Common.ok(alerts.acknowledge(id, uid));
  }

  @PostMapping("/escalate")
  public Map<String, Object> escalate(@RequestHeader(value = "Authorization", required = false) String header) {
    auth.requireUser(header);
    return Common.ok(Common.map("escalated", notifications.escalateOverdue()));
  }

  @PostMapping("/{id}/assign")
  public Map<String, Object> assign(
      @PathVariable long id,
      @RequestHeader(value = "Authorization", required = false) String header,
      @RequestBody Map<String, Object> body) {
    long operator = auth.requireUser(header);
    long assignee = Common.num(body.get("userId"));
    return Common.ok(alerts.assign(id, assignee, operator));
  }

  @PostMapping("/{id}/resolve")
  public Map<String, Object> resolve(
      @PathVariable long id,
      @RequestHeader(value = "Authorization", required = false) String header,
      @RequestBody(required = false) Map<String, Object> body) {
    long uid = auth.requireUser(header);
    return Common.ok(alerts.resolve(id, uid, body == null ? null : Common.str(body.get("note"))));
  }
}
