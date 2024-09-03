Jekyll::Hooks.register :site, :pre_render do |site|
  site.data['last_updated'] = `git log -1 --format="%ar"`.strip
  puts "Last updated time: #{site.data['last_updated']}"
end