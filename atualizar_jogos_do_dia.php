<?php
/**
 * ATUALIZADOR AUTOMÁTICO DE JOGOS DO DIA (FUTEBOL AO VIVO)
 * Para servidores de hospedagem web (cPanel, Apache, Nginx, PHP 7.4+)
 * 
 * Como usar no Cron Job do seu cPanel/Servidor:
 * Exemplo (rodar todo dia às 06:00 e às 14:00):
 * 0 6,14 * * * /usr/bin/php /home/seusuario/public_html/atualizar_jogos_do_dia.php
 */

header('Content-Type: text/plain; charset=utf-8');

$playlistPath = __DIR__ . '/Canais de TV.m3u8';

if (!file_exists($playlistPath)) {
    die("Erro: Arquivo 'Canais de TV.m3u8' não encontrado em: $playlistPath\n");
}

echo "=== ATUALIZADOR AUTOMÁTICO DE JOGOS DO DIA (PHP) ===\n";
echo "Lendo playlist: $playlistPath\n";

$content = file_get_contents($playlistPath);
$lines = explode("\n", $content);

$header = '#EXTM3U url-tvg="https://iptv-org.github.io/epg/guides/br/mi.tv.epg.xml.gz,https://iptv-org.github.io/epg/guides/br/claro.com.br.epg.xml.gz" x-tvg-url="https://iptv-org.github.io/epg/guides/br/mi.tv.epg.xml.gz"';
$otherChannels = [];

for ($i = 0; $i < count($lines); $i++) {
    $line = trim($lines[$i]);
    if (empty($line)) continue;
    if (strpos($line, '#EXTM3U') === 0) {
        $header = $line;
        continue;
    }
    if (strpos($line, '#EXTINF') === 0) {
        $url = isset($lines[$i + 1]) ? trim($lines[$i + 1]) : '';
        // Pula os Jogos do Dia anteriores para renovar com os de hoje
        if (strpos($line, 'group-title="⚽ Jogos do Dia"') !== false) {
            $i++; // pula url
            continue;
        }
        $otherChannels[] = ['extinf' => $line, 'url' => $url];
        $i++; // pula url
    }
}

echo "Canais fixos mantidos: " . count($otherChannels) . "\n";

$leagues = [
    ['name' => 'Brasileirão', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.1/scoreboard'],
    ['name' => 'Copa do Brasil', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/bra.copa_do_brasil/scoreboard'],
    ['name' => 'Libertadores', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/conmebol.libertadores/scoreboard'],
    ['name' => 'Sul-Americana', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/conmebol.sudamericana/scoreboard'],
    ['name' => 'Champions League', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard'],
    ['name' => 'Premier League', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard'],
    ['name' => 'La Liga', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.1/scoreboard'],
    ['name' => 'Liga Portugal', 'url' => 'https://site.api.espn.com/apis/site/v2/sports/soccer/por.1/scoreboard']
];

function fetchLeague($url) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_ENCODING, ''); // aceita gzip/deflate
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);
    curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $response = curl_exec($ch);
    curl_close($ch);
    if (!$response) return [];
    $json = json_decode($response, true);
    return isset($json['events']) ? $json['events'] : [];
}

$streamMap = [
    'premiere1' => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/9037.ts',
    'premiere2' => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/9022.ts',
    'premiere3' => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/69030.ts',
    'sportv'    => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/9111.ts',
    'sportv2'   => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/30123.ts',
    'espn'      => 'http://corruptx.org:80/live/3llohwk4g9/kwf099q30o/598914.m3u8',
    'espn2'     => 'http://corruptx.org:80/live/3llohwk4g9/kwf099q30o/8786.m3u8',
    'caze1'     => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/9111.ts',
    'param1'    => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/9111.ts',
    'param2'    => 'http://corruptx.org:80/3llohwk4g9/kwf099q30o/30123.ts',
    'portocanal'=> 'https://pull-live-156-1.global.ssl.fastly.net/pc5865dc25400thmb-ea6bf03b14fa318f7133/smil:pc1-jhrgyuoqe5865db-68tkgb14fa318f7133f03.smil/playlist.m3u8'
];

$logos = [
    'premiere' => 'http://logos.appscms.xyz/logos/2025/premiere.png',
    'sportv'   => 'http://logos.appscms.xyz/logos/2025/sportv.png',
    'espn'     => 'http://logos.appscms.xyz/logos/2025/espn.png',
    'caze'     => 'http://logos.appscms.xyz/logos/2025/cazetv.png',
    'param'    => 'https://logos.appscms.xyz/logos/2025/Paramount.png',
    'porto'    => 'https://i.imgur.com/DwziwMY.png'
];

$matchEntries = [];
$premIdx = 1;
$paramIdx = 1;

date_default_timezone_set('America/Sao_Paulo');

foreach ($leagues as $l) {
    $events = fetchLeague($l['url']);
    foreach ($events as $e) {
        $ts = strtotime($e['date']);
        $dateStr = date('d/m', $ts);
        $timeStr = date('H:i', $ts);
        
        $home = 'Casa';
        $away = 'Fora';
        foreach ($e['competitions'][0]['competitors'] as $c) {
            if ($c['homeAway'] === 'home') $home = $c['team']['displayName'];
            if ($c['homeAway'] === 'away') $away = $c['team']['displayName'];
        }

        $channelName = 'Premiere';
        $streamUrl = $streamMap['premiere1'];
        $logoUrl = $logos['premiere'];

        if ($l['name'] === 'Brasileirão') {
            if ($premIdx === 1) { $channelName = 'Premiere 1'; $streamUrl = $streamMap['premiere1']; }
            elseif ($premIdx === 2) { $channelName = 'Premiere 2'; $streamUrl = $streamMap['premiere2']; }
            else { $channelName = 'SporTV'; $streamUrl = $streamMap['sportv']; $logoUrl = $logos['sportv']; }
            $premIdx++;
        } elseif ($l['name'] === 'Libertadores' || $l['name'] === 'Sul-Americana') {
            $channelName = 'ESPN / SporTV';
            $streamUrl = $streamMap['sportv'];
            $logoUrl = $logos['sportv'];
        } elseif ($l['name'] === 'Champions League') {
            $channelName = "Paramount+ $paramIdx";
            $streamUrl = $paramIdx === 1 ? $streamMap['param1'] : $streamMap['param2'];
            $logoUrl = $logos['param'];
            $paramIdx = $paramIdx === 1 ? 2 : 1;
        } elseif ($l['name'] === 'Premier League' || $l['name'] === 'La Liga') {
            $channelName = 'ESPN';
            $streamUrl = $streamMap['espn'];
            $logoUrl = $logos['espn'];
        } elseif ($l['name'] === 'Liga Portugal') {
            $channelName = 'Porto Canal';
            $streamUrl = $streamMap['portocanal'];
            $logoUrl = $logos['porto'];
        }

        $matchTitle = "⚽ [$dateStr $timeStr] $home x $away ($channelName)";
        $matchEntries[] = [
            'title' => $matchTitle,
            'logo' => $logoUrl,
            'url' => $streamUrl
        ];
    }
}

echo "Sucesso: " . count($matchEntries) . " jogos encontrados e formatados.\n";

$newM3U = $header . "\n";
foreach ($matchEntries as $m) {
    $newM3U .= "#EXTINF:-1 tvg-id=\"FutebolAoVivo.br\" tvg-name=\"{$m['title']}\" tvg-logo=\"{$m['logo']}\" group-title=\"⚽ Jogos do Dia\",{$m['title']}\n{$m['url']}\n";
}
foreach ($otherChannels as $c) {
    $newM3U .= "{$c['extinf']}\n{$c['url']}\n";
}

file_put_contents($playlistPath, $newM3U);
echo "✅ Playlist Canais de TV.m3u8 atualizada com sucesso! Total: " . (count($matchEntries) + count($otherChannels)) . " canais.\n";
