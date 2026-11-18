package com.agri.trace;

import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "02 概览与地块")
@RestController
@RequestMapping("/api")
public class PlotController {
  private final PlotService plots;

  public PlotController(PlotService plots) {
    this.plots = plots;
  }

  @GetMapping("/plots/overview")
  public Map<String, Object> overview(@RequestParam(required = false) Long farmId) {
    return Common.ok(plots.overview(farmId));
  }

  @GetMapping("/plots/page")
  public Map<String, Object> page(
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size,
      @RequestParam(required = false) Integer status,
      @RequestParam(required = false) String crop,
      @RequestParam(required = false) String kw,
      @RequestParam(required = false) Long farmId) {
    return Common.ok(plots.page(page, size, status, crop, kw, farmId));
  }

  @GetMapping("/plots/{id}/detail")
  public Map<String, Object> detail(@PathVariable long id) {
    return Common.ok(plots.detail(id));
  }

  @GetMapping("/plots/{id}/batch")
  public Map<String, Object> batch(@PathVariable long id) {
    return Common.ok(plots.batchOfPlot(id));
  }

  @GetMapping("/dashboard/overview")
  public Map<String, Object> dashboard(@RequestParam(required = false) Long farmId) {
    return Common.ok(plots.dashboard(farmId));
  }
}
