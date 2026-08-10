$ErrorActionPreference = "Stop"

$families = @(
  @{ Id = "ebgaramond"; Name = "EB Garamond" }, @{ Id = "economica"; Name = "Economica" },
  @{ Id = "firasans"; Name = "Fira Sans" }, @{ Id = "fjordone"; Name = "Fjord One" },
  @{ Id = "gabriela"; Name = "Gabriela" }, @{ Id = "gaegu"; Name = "Gaegu" },
  @{ Id = "habibi"; Name = "Habibi" }, @{ Id = "heebo"; Name = "Heebo" },
  @{ Id = "inconsolata"; Name = "Inconsolata" }, @{ Id = "indieflower"; Name = "Indie Flower" },
  @{ Id = "jetbrainsmono"; Name = "JetBrains Mono" }, @{ Id = "josefinsans"; Name = "Josefin Sans" },
  @{ Id = "kalam"; Name = "Kalam" }, @{ Id = "kavoon"; Name = "Kavoon" },
  @{ Id = "lato"; Name = "Lato" }, @{ Id = "leaguegothic"; Name = "League Gothic" },
  @{ Id = "merriweather"; Name = "Merriweather" }, @{ Id = "montserrat"; Name = "Montserrat" },
  @{ Id = "nabla"; Name = "Nabla" }, @{ Id = "neucha"; Name = "Neucha" },
  @{ Id = "opensans"; Name = "Open Sans" }, @{ Id = "orbitron"; Name = "Orbitron" },
  @{ Id = "poppins"; Name = "Poppins" }, @{ Id = "permanentmarker"; Name = "Permanent Marker" },
  @{ Id = "quicksand"; Name = "Quicksand" }, @{ Id = "questrial"; Name = "Questrial" },
  @{ Id = "raleway"; Name = "Raleway" }, @{ Id = "roboto"; Name = "Roboto" },
  @{ Id = "sacramento"; Name = "Sacramento" }, @{ Id = "sourcecodepro"; Name = "Source Code Pro" },
  @{ Id = "teko"; Name = "Teko" }, @{ Id = "titilliumweb"; Name = "Titillium Web" },
  @{ Id = "ubuntu"; Name = "Ubuntu" }, @{ Id = "unbounded"; Name = "Unbounded" },
  @{ Id = "varelaround"; Name = "Varela Round" }, @{ Id = "vollkorn"; Name = "Vollkorn" },
  @{ Id = "workbench"; Name = "Workbench" }, @{ Id = "worksans"; Name = "Work Sans" },
  @{ Id = "xanhmono"; Name = "Xanh Mono" }, @{ Id = "yanonekaffeesatz"; Name = "Yanone Kaffeesatz" },
  @{ Id = "yellowtail"; Name = "Yellowtail" }, @{ Id = "zeyada"; Name = "Zeyada" },
  @{ Id = "zillaslab"; Name = "Zilla Slab" }
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$fontDirectory = Join-Path $root "assets\fonts"
$catalogPath = Join-Path $root "src\google-font-catalog.js"
$catalog = Get-Content -LiteralPath $catalogPath -Raw
$entries = [System.Collections.Generic.List[string]]::new()

foreach ($family in $families) {
  if ($catalog -match ('"id":"' + [regex]::Escape($family.Id) + '"')) {
    Write-Host "Skipping existing $($family.Name)"
    continue
  }
  try {
    $files = Invoke-RestMethod -Uri "https://api.github.com/repos/google/fonts/contents/ofl/$($family.Id)?ref=main"
    $ttf = @($files | Where-Object { $_.type -eq "file" -and $_.name -match "\.ttf$" -and $_.name -notmatch "Italic" } |
      Sort-Object @{ Expression = { if ($_.name -match "Regular") { 0 } else { 1 } } }, name | Select-Object -First 1)
    if (-not $ttf) {
      Write-Warning "No upright TTF found for $($family.Name)"
      continue
    }
    $fileStem = ($family.Name -replace "[^A-Za-z0-9]", "")
    $fileName = "$fileStem-Regular.ttf"
    Invoke-WebRequest -Uri $ttf[0].download_url -OutFile (Join-Path $fontDirectory $fileName)
    $entries.Add(('  {{"id":"{0}","name":"{1}","kind":"outline","family":"{1}","asset":"assets/fonts/{2}"}}' -f $family.Id, $family.Name, $fileName))
    Write-Host "Added $($family.Name)"
  } catch {
    Write-Warning "Skipped $($family.Name): $($_.Exception.Message)"
  }
}

if ($entries.Count) {
  $catalog = $catalog -replace "\r?\n\];\s*$", ("`r`n" + ($entries -join ",`r`n") + "`r`n];`r`n")
  Set-Content -LiteralPath $catalogPath -Value $catalog -NoNewline
}

Write-Host "Added $($entries.Count) font families."
