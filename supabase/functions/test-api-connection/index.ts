// Edge Function: test-api-connection
// Proxies API connection test to avoid browser CORS restrictions
// Tries multiple URL paths and classifies responses intelligently

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Classifica uma resposta HTTP e retorna mensagem amigável.
 * Qualquer resposta HTTP (mesmo 401/404) prova que o servidor está acessível.
 */
function classifyResponse(status: number, url: string): { success: boolean; message: string } {
    if (status >= 200 && status < 300) {
        return { success: true, message: `✅ Conexão OK! Status ${status} em ${url}` };
    }
    if (status === 401 || status === 403) {
        return {
            success: false,
            message: `⚠️ Servidor acessível (${url}), mas autenticação falhou (${status}). Verifique a API Key e o Header de autenticação.`,
        };
    }
    if (status === 404) {
        return {
            success: false,
            message: `⚠️ Servidor acessível, mas endpoint não encontrado (404 em ${url}). Verifique a URL base.`,
        };
    }
    if (status >= 500) {
        return {
            success: false,
            message: `⚠️ Servidor acessível, mas retornou erro interno (${status} em ${url}).`,
        };
    }
    return {
        success: false,
        message: `⚠️ Servidor respondeu com status ${status} em ${url}.`,
    };
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // 1. Validate auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return new Response(
                JSON.stringify({ success: false, message: 'Não autorizado' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 2. Parse request body
        const body = await req.json();
        const { apiBaseUrl, apiKey, authType, authHeader: customAuthHeader, extraHeaders } = body;

        if (!apiBaseUrl) {
            return new Response(
                JSON.stringify({ success: false, message: 'URL da API não informada' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Build headers for API call
        const fetchHeaders: Record<string, string> = {
            'Accept': 'application/json',
            ...(extraHeaders || {}),
        };

        // Apply auth based on configured type
        if (apiKey) {
            if (authType === 'bearer') {
                fetchHeaders[customAuthHeader || 'Authorization'] = `Bearer ${apiKey}`;
            } else if (authType === 'api_key') {
                fetchHeaders[customAuthHeader || 'X-API-Key'] = apiKey;
            } else if (authType === 'basic') {
                fetchHeaders[customAuthHeader || 'Authorization'] = `Basic ${btoa(apiKey)}`;
            }
        }

        // Log headers being sent (mask the key value for security)
        const debugHeaders = { ...fetchHeaders };
        for (const [k, v] of Object.entries(debugHeaders)) {
            if (k.toLowerCase().includes('key') || k.toLowerCase().includes('auth')) {
                debugHeaders[k] = v.substring(0, 6) + '****';
            }
        }
        console.log(`Auth config: type=${authType}, header=${customAuthHeader}`);
        console.log(`Headers being sent: ${JSON.stringify(debugHeaders)}`);

        // 4. Build list of URLs to try (in order of priority)
        //    /health first (DAB base URL often returns 400 by design)
        const baseUrlClean = apiBaseUrl.replace(/\/+$/, '');

        const healthUrl = `${baseUrlClean}/health`;
        const urlsToTry = [healthUrl];

        // Also try root /health if base has a path (e.g. /v1)
        try {
            const parsed = new URL(baseUrlClean);
            if (parsed.pathname && parsed.pathname !== '/') {
                const rootHealthUrl = `${parsed.origin}/health`;
                if (!urlsToTry.includes(rootHealthUrl)) {
                    urlsToTry.push(rootHealthUrl);
                }
            }
        } catch { /* ignore invalid URL */ }

        // Try base URL last (DAB often returns 400 on base)
        urlsToTry.push(baseUrlClean);

        console.log(`URLs to try: ${JSON.stringify(urlsToTry)}`);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            for (const testUrl of urlsToTry) {
                console.log(`Trying: ${testUrl}`);
                try {
                    const response = await fetch(testUrl, {
                        method: 'GET',
                        headers: fetchHeaders,
                        signal: controller.signal,
                    });

                    console.log(`${testUrl} → ${response.status} ${response.statusText}`);

                    // 2xx = success, return immediately
                    if (response.ok) {
                        clearTimeout(timeout);
                        const result = classifyResponse(response.status, testUrl);
                        return new Response(
                            JSON.stringify(result),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }

                    // 401/403 = server reachable but auth failed — return diagnostic immediately
                    if (response.status === 401 || response.status === 403) {
                        clearTimeout(timeout);
                        const result = classifyResponse(response.status, testUrl);
                        return new Response(
                            JSON.stringify(result),
                            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                        );
                    }

                    // 404 or 400 = this specific path doesn't exist, try next URL
                    if (response.status === 404 || response.status === 400) {
                        console.log(`${testUrl} returned ${response.status}, trying next...`);
                        continue;
                    }

                    // Other status (5xx, etc.) — return diagnostic
                    clearTimeout(timeout);
                    const result = classifyResponse(response.status, testUrl);
                    return new Response(
                        JSON.stringify(result),
                        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    );

                } catch (urlErr) {
                    const msg = urlErr instanceof Error ? urlErr.message : 'unknown';
                    console.log(`${testUrl} fetch error: ${msg}, trying next...`);
                    continue;
                }
            }

            clearTimeout(timeout);

            return new Response(
                JSON.stringify({
                    success: false,
                    message: `❌ Nenhum endpoint respondeu. URLs testadas: ${urlsToTry.join(', ')}. Verifique a URL base.`,
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );

        } catch (fetchErr) {
            clearTimeout(timeout);
            const msg = fetchErr instanceof Error ? fetchErr.message : 'Erro desconhecido';

            if (msg.includes('abort')) {
                return new Response(
                    JSON.stringify({ success: false, message: '❌ Timeout — a API não respondeu em 15 segundos' }),
                    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
            }

            return new Response(
                JSON.stringify({ success: false, message: `❌ Não foi possível conectar: ${msg}` }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

    } catch (err: unknown) {
        console.error('Error in test-api-connection:', err);
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        return new Response(
            JSON.stringify({ success: false, message: `❌ Erro interno: ${message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
