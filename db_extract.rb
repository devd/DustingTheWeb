#!/usr/bin/env ruby

require 'json'
require 'csv'
require 'uri'
require 'net/https'

# To run: ruby db_extract.rb
# Output is a csv file "db_dump.csv" with all of the raw data.
#
# https://github.com/rzhao/dustingtheweb_db is source code for the DB

page = 1
done = false

File.delete "db_dump.csv" if File.exists? "db_dump.csv"

until done
  puts "Getting page #{page}..."
  uri = URI.parse("https://yourapp.herokuapp.com/dump?page=#{page}")
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true

  request = Net::HTTP::Get.new(uri.path + "?" + uri.query)

  response = http.start do |r|
    r.request request
  end

  dump = JSON.parse response.body
  
  done = dump["done"]

  CSV.open("db_dump.csv", "a") do |csv|
    csv << ["Vulnerability ID", "URL", "Count", "Text", "Crawler", "Created At"]
    dump["messages"].each do |message|
      csv << [message["vulnerability_id"], message["url"], message["count"], message["text"], message["crawler"], message["created_at"]]
    end
  end
  
  page += 1
end

puts "Done!"
