package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "01 认证")
@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;

  public AuthController(AuthService auth) {
    this.auth = auth;
  }

  @PostMapping("/login")
  public Map<String, Object> login(@RequestBody Map<String, Object> body) {
    return Common.ok(auth.login(Common.str(body.get("username")), Common.str(body.get("password"))));
  }

  @GetMapping("/me")
  public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String header) {
    return Common.ok(auth.me(header));
  }

  @PostMapping("/profile")
  public Map<String, Object> profile(
      @RequestHeader(value = "Authorization", required = false) String header,
      @RequestBody Map<String, Object> body) {
    return Common.ok(auth.updateProfile(header, Common.str(body.get("phone"))));
  }

  @PostMapping("/password")
  public Map<String, Object> password(
      @RequestHeader(value = "Authorization", required = false) String header,
      @RequestBody Map<String, Object> body) {
    auth.changePassword(header, Common.str(body.get("oldPassword")), Common.str(body.get("newPassword")));
    return Common.ok(true);
  }

  @PostMapping("/logout")
  public Map<String, Object> logout(@RequestHeader(value = "Authorization", required = false) String header) {
    auth.logout(header);
    return Common.ok(true);
  }
}
