const { supabase } = require('../database');

const authMiddleware = async (req, res, next) => {
    // The access token is stored in a cookie by Supabase Auth.
    // The cookie name is dynamic, so we need to find it.
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return next();

    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
    }, {});

    // Find the Supabase auth token cookie, which starts with 'sb-' and ends with '-auth-token'
    const authTokenKey = Object.keys(cookies).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    const token = authTokenKey ? cookies[authTokenKey] : null;

    if (!token) {
        // No token found, continue without an authenticated user
        return next();
    }

    try {
        // The token is a URI-encoded JSON string. We need to decode and parse it.
        const parsedToken = JSON.parse(decodeURIComponent(token));
        const accessToken = parsedToken?.access_token;

        if (!accessToken) {
            return next();
        }

        // Verify the access token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(accessToken);

        if (error) {
            // Token is invalid or expired
            console.warn('Auth middleware: Invalid token.', error.message);
            return next();
        }

        // Attach the authenticated user to the request object
        if (user) {
            // To be safe, let's get our internal user ID from our own database
            const { data: dbUser, error: dbError } = await supabase
                .from('users')
                .select('id')
                .eq('firebase_uid', user.id)
                .single();

            if (dbError || !dbUser) {
                 console.error('Auth middleware: Could not find corresponding user in our DB for Supabase UID:', user.id);
                 return next();
            }
            
            // Attach our internal user ID to the request for use in other routes
            req.user = { id: dbUser.id, ...user };
        }
        
    } catch (error) {
        console.error('Auth middleware: Unexpected error parsing token or fetching user.', error);
    }

    next();
};

module.exports = authMiddleware;
