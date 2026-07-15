> Parte da skill `wp-performance-review` — carregado on-demand via Read().

## Anti-Pattern Reference

### Database Queries
```php
// ❌ CRITICAL: Unbounded query.
'posts_per_page' => -1

// ✅ GOOD: Set reasonable limit, paginate if needed.
'posts_per_page' => 100,
'no_found_rows'  => true, // Skip count if not paginating.

// ❌ CRITICAL: Never use query_posts().
query_posts( 'cat=1' ); // Breaks pagination, conditionals.

// ✅ GOOD: Use WP_Query or pre_get_posts filter.
$query = new WP_Query( array( 'cat' => 1 ) );
// Or modify main query:
add_action( 'pre_get_posts', function( $query ) {
    if ( $query->is_main_query() && ! is_admin() ) {
        $query->set( 'cat', 1 );
    }
} );

// ❌ CRITICAL: Missing WHERE clause (falsy ID becomes 0).
$query = new WP_Query( array( 'p' => intval( $maybe_false_id ) ) );

// ✅ GOOD: Validate ID before querying.
if ( ! empty( $maybe_false_id ) ) {
    $query = new WP_Query( array( 'p' => intval( $maybe_false_id ) ) );
}

// ❌ WARNING: LIKE with leading wildcard (full table scan).
$wpdb->get_results( "SELECT * FROM wp_posts WHERE post_title LIKE '%term%'" );

// ✅ GOOD: Use trailing wildcard only, or use WP_Query 's' parameter.
$wpdb->get_results( $wpdb->prepare(
    "SELECT * FROM wp_posts WHERE post_title LIKE %s",
    $wpdb->esc_like( $term ) . '%'
) );

// ❌ WARNING: NOT IN queries (filter in PHP instead).
'post__not_in' => $excluded_ids

// ✅ GOOD: Fetch all, filter in PHP (faster for large exclusion lists).
$posts = get_posts( array( 'posts_per_page' => 100 ) );
$posts = array_filter( $posts, function( $post ) use ( $excluded_ids ) {
    return ! in_array( $post->ID, $excluded_ids, true );
} );
```

### Hooks & Actions
```php
// ❌ WARNING: Code runs on every request via init.
add_action( 'init', 'expensive_function' );

// ✅ GOOD: Check context before running expensive code.
add_action( 'init', function() {
    if ( is_admin() || wp_doing_cron() ) {
        return;
    }
    // Frontend-only code here.
} );

// ❌ CRITICAL: Database writes on every page load.
add_action( 'wp_head', 'prefix_bad_tracking' );
function prefix_bad_tracking() {
    update_option( 'last_visit', time() );
}

// ✅ GOOD: Use object cache buffer, flush via cron.
add_action( 'shutdown', function() {
    wp_cache_incr( 'page_views_buffer', 1, 'counters' );
} );

// ❌ WARNING: Using admin-ajax.php instead of REST API.
// Prefer: register_rest_route() - leaner bootstrap.
```

### PHP Code
```php
// ❌ WARNING: O(n) lookup - use isset() with associative array.
in_array( $value, $array ); // Also missing strict = true.

// ✅ GOOD: O(1) lookup with isset().
$allowed = array( 'foo' => true, 'bar' => true );
if ( isset( $allowed[ $value ] ) ) {
    // Process.
}

// ❌ WARNING: Heredoc prevents late escaping.
$html = <<<HTML
<div>$unescaped_content</div>
HTML;

// ✅ GOOD: Escape at output.
printf( '<div>%s</div>', esc_html( $content ) );
```

### Caching Issues
```php
// ❌ WARNING: Uncached expensive function calls.
url_to_postid( $url );
attachment_url_to_postid( $attachment_url );
count_user_posts( $user_id );
wp_oembed_get( $url );

// ✅ GOOD: Wrap with object cache (works on any host).
function prefix_cached_url_to_postid( $url ) {
    $cache_key = 'url_to_postid_' . md5( $url );
    $post_id   = wp_cache_get( $cache_key, 'url_lookups' );

    if ( false === $post_id ) {
        $post_id = url_to_postid( $url );
        wp_cache_set( $cache_key, $post_id, 'url_lookups', HOUR_IN_SECONDS );
    }

    return $post_id;
}

// ✅ GOOD: On WordPress VIP, use platform helpers instead.
// wpcom_vip_url_to_postid(), wpcom_vip_attachment_url_to_postid(), etc.

// ❌ WARNING: Large autoloaded options.
add_option( 'prefix_large_data', $data ); // Add: , '', 'no' for autoload.

// ❌ INFO: Missing wp_cache_get_multiple for batch lookups.
foreach ( $ids as $id ) {
    wp_cache_get( "key_{$id}" );
}
```

### AJAX & External Requests
```javascript
// ❌ WARNING: AJAX POST request (bypasses cache).
$.post( ajaxurl, data ); // Prefer: $.get() for read operations.

// ❌ CRITICAL: Polling pattern (self-DDoS).
setInterval( () => fetch( '/wp-json/...' ), 5000 );
```

```php
// ❌ WARNING: Synchronous external HTTP in page load.
wp_remote_get( $url ); // Cache result or move to cron.

// ✅ GOOD: Set timeout and handle errors.
$response = wp_remote_get( $url, array( 'timeout' => 2 ) );
if ( is_wp_error( $response ) ) {
    return get_fallback_data();
}
```

### WP Cron
```php
// ❌ WARNING: WP Cron runs on page requests.
// Add to wp-config.php:
define( 'DISABLE_WP_CRON', true );
// Run via server cron: * * * * * wp cron event run --due-now

// ❌ CRITICAL: Long-running cron blocks entire queue.
add_action( 'my_daily_sync', function() {
    foreach ( get_users() as $user ) { // 50k users = hours.
        sync_user_data( $user );
    }
} );

// ✅ GOOD: Batch processing with rescheduling.
add_action( 'my_batch_sync', function() {
    $offset = (int) get_option( 'sync_offset', 0 );
    $users  = get_users( array( 'number' => 100, 'offset' => $offset ) );

    if ( empty( $users ) ) {
        delete_option( 'sync_offset' );
        return;
    }

    foreach ( $users as $user ) {
        sync_user_data( $user );
    }

    update_option( 'sync_offset', $offset + 100 );
    wp_schedule_single_event( time() + 60, 'my_batch_sync' );
} );

// ❌ WARNING: Scheduling without checking if already scheduled.
wp_schedule_event( time(), 'hourly', 'my_task' ); // Creates duplicates!

// ✅ GOOD: Check before scheduling.
if ( ! wp_next_scheduled( 'my_task' ) ) {
    wp_schedule_event( time(), 'hourly', 'my_task' );
}
```

### Cache Bypass Issues
```php
// ❌ CRITICAL: Plugin starts PHP session on frontend (bypasses ALL page cache).
session_start(); // Check plugins for this - entire site becomes uncacheable!

// ❌ WARNING: Unique query params create cache misses.
// https://example.com/?utm_source=fb&utm_campaign=123&fbclid=abc
// Each unique URL = separate cache entry = cache miss.
// Solution: Strip marketing params at CDN/edge level.

// ❌ WARNING: Setting cookies on public pages.
setcookie( 'visitor_id', $id ); // Prevents caching for that user.
```

### Transients Misuse
```php
// ❌ WARNING: Dynamic transient keys create table bloat (without object cache).
set_transient( "user_{$user_id}_cart", $data, HOUR_IN_SECONDS );
// 10,000 users = 10,000 rows in wp_options!

// ✅ GOOD: Use object cache for user-specific data.
wp_cache_set( "cart_{$user_id}", $data, 'user_carts', HOUR_IN_SECONDS );

// ❌ WARNING: Transients for frequently-changing data defeats purpose.
set_transient( 'visitor_count', $count, 60 ); // Changes every minute.

// ✅ GOOD: Use object cache for volatile data.
wp_cache_set( 'visitor_count', $count, 'stats' );

// ❌ WARNING: Large data in transients on shared hosting.
set_transient( 'api_response', $megabytes_of_json, DAY_IN_SECONDS );
// Without object cache = serialized blob in wp_options.

// ✅ GOOD: Check hosting before using transients for large data.
if ( wp_using_ext_object_cache() ) {
    set_transient( 'api_response', $data, DAY_IN_SECONDS );
} else {
    // Store in files or skip caching on shared hosting.
}
```

### Asset Loading
```php
// ❌ WARNING: Assets load globally when only needed on specific pages.
add_action( 'wp_enqueue_scripts', function() {
    wp_enqueue_script( 'contact-form-js', ... );
    wp_enqueue_style( 'contact-form-css', ... );
} );

// ✅ GOOD: Conditional enqueue based on page/template.
add_action( 'wp_enqueue_scripts', function() {
    if ( is_page( 'contact' ) || is_page_template( 'contact-template.php' ) ) {
        wp_enqueue_script( 'contact-form-js', ... );
        wp_enqueue_style( 'contact-form-css', ... );
    }
} );

// ✅ GOOD: Only load WooCommerce assets on shop pages.
add_action( 'wp_enqueue_scripts', function() {
    if ( ! is_woocommerce() && ! is_cart() && ! is_checkout() ) {
        wp_dequeue_style( 'woocommerce-general' );
        wp_dequeue_script( 'wc-cart-fragments' );
    }
} );
```

### External API Requests
```php
// ❌ WARNING: No timeout set (default is 5 seconds).
wp_remote_get( $url ); // Set timeout: array( 'timeout' => 2 ).

// ❌ WARNING: Missing error handling for API failures.
$response = wp_remote_get( $url );
echo $response['body']; // Check is_wp_error() first!
```

### Sitemaps & Redirects
```php
// ❌ WARNING: Generating sitemaps for deep archives (crawlers hammer these).
// Solution: Exclude old post types, cache generated sitemaps.

// ❌ CRITICAL: Redirect loops consuming CPU.
// Debug with: x-redirect-by header, wp_debug_backtrace_summary().
```

### Post Meta Queries
```php
// ❌ WARNING: Searching meta_value without index.
'meta_query' => array(
    array(
        'key'   => 'color',
        'value' => 'red',
    ),
)
// Better: Use taxonomy or encode value in meta_key name.

// ❌ WARNING: Binary meta values requiring value scan.
'meta_key'   => 'featured',
'meta_value' => 'true',
// Better: Presence of 'is_featured' key = true, absence = false.
```
