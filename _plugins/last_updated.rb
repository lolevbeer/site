require 'date'

Jekyll::Hooks.register :site, :pre_render do |site|
  # Get the last commit time from the git log
  last_commit_time = `git log -1 --format="%at"`.strip.to_i
  # Convert the timestamp to a readable format
  last_updated_time = Time.at(last_commit_time).utc.iso8601

  # Store the last updated time in the site data
  site.data['last_updated'] = last_updated_time
  puts "Last updated time: #{site.data['last_updated']}"
end