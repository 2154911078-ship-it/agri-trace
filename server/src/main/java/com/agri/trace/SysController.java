package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "09 系统")
@RestController
@RequestMapping("/api/sys")
public class SysController {
  private final SysService sys;

  public SysController(SysService sys) {
    this.sys = sys;
  }

  @GetMapping
  public Map<String, Object> page() {
    return Common.ok(sys.page());
  }

  @PostMapping("/users")
  public Map<String, Object> createUser(@RequestBody Map<String, Object> body) {
    return Common.ok(sys.createUser(body));
  }

  @PostMapping("/users/{id}/toggle")
  public Map<String, Object> toggle(@PathVariable long id) {
    return Common.ok(sys.toggleUser(id));
  }
}
