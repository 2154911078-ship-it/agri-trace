package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "04 追溯")
@RestController
@RequestMapping("/api/trace")
public class TraceController {
  private final BatchService batches;

  public TraceController(BatchService batches) {
    this.batches = batches;
  }

  @GetMapping("/logs")
  public Map<String, Object> logs(@RequestParam(required = false) String kw,
      @RequestParam(required = false) Long farmId,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return Common.ok(batches.logs(kw, farmId, page, size));
  }

  @PostMapping("/{code}/scan")
  public Map<String, Object> scan(
      @PathVariable String code,
      @RequestBody(required = false) Map<String, Object> body,
      HttpServletRequest request) {
    String region = body == null ? null : Common.str(body.get("region"));
    String ip = request.getHeader("X-Forwarded-For");
    if (ip == null) ip = request.getRemoteAddr();
    return Common.ok(batches.scan(code, region, ip, request.getHeader("User-Agent")));
  }

  @GetMapping("/{code}/verify")
  public Map<String, Object> verify(@PathVariable String code) {
    return Common.ok(batches.verify(code));
  }

  @GetMapping("/{code}")
  public Map<String, Object> trace(@PathVariable String code) {
    return Common.ok(batches.trace(code));
  }
}
