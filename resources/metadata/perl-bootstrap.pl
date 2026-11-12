# Fixed BLEGO launcher. All module paths are set by the main-owned engine adapter.
# Do not consult system/site/user Perl module directories.
BEGIN {
    @INC = split(/\x1f/, $ENV{'BLEGO_PERL_LIBS'} || '');
}
my $script = shift @ARGV;
die "Missing bundled ExifTool script" unless defined $script;
$0 = $script;
do $script;
die $@ if $@;
