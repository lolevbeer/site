require "base64"

module Base64Filter
  def base64_encode (input)
    Base64.strict_encode64(File.open(input).read)
  end
end

Liquid::Template.register_filter(Base64Filter) # register filter globally
