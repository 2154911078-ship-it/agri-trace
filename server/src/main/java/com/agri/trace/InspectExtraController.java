package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "14 复检与处置")
@RestController
@RequestMapping("/api")
public class InspectExtraController {
  private final InspectService inspects;

  public InspectExtraController(InspectService inspects) {
    this.inspects = inspects;
  }

  @GetMapping("/inspect-templates")
  public Map<String, Object> templates() {
    return Common.ok(inspects.templates());
  }

  @PostMapping("/inspect-templates")
  public Map<String, Object> createTemplate(@RequestBody Map<String, Object> body) {
    return Common.ok(inspects.createTemplate(body));
  }

  @PostMapping("/inspects/{id}/recheck")
  public Map<String, Object> recheck(@PathVariable long id, @RequestBody Map<String, Object> body) {
    return Common.ok(inspects.recheck(id, body));
  }

  @PostMapping("/inspects/{id}/dispose")
  public Map<String, Object> dispose(@PathVariable long id, @RequestBody Map<String, Object> body) {
    return Common.ok(inspects.dispose(id, body));
  }
}
